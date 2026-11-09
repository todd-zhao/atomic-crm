import { ResourceContextProvider, ShowBase } from "ra-core";
import { useQueryClient } from "@tanstack/react-query";
import { render } from "vitest-browser-react";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import { buildContact, createCrmDb, StoryWrapper } from "@/test/StoryWrapper";
import { ContactAside } from "./ContactAside";
import { ContactShow } from "./ContactShow";
import { MobileSuccess } from "./ContactShow.mobile.stories";

const mockIsMobile = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockIsMobile,
}));

describe("ContactShow", () => {
  beforeEach(() => {
    mockIsMobile.mockReturnValue(true);
  });

  it("renders a safe zero-task label before nb_tasks is available", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
    await expect
      .poll(
        () => screen.container.textContent?.includes("%{smart_count}") ?? false,
      )
      .toBe(false);
    await expect
      .poll(() => screen.container.textContent?.includes("||||") ?? false)
      .toBe(false);
  });

  it("offers search but no refresh in the header of a contact page", async () => {
    const screen = await render(<MobileSuccess />);

    await expect
      .element(screen.getByRole("button", { name: "Search", exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Refresh" }))
      .not.toBeInTheDocument();
  });

  it("opens on the tab named in the URL, as global search links to tasks", async () => {
    const screen = await render(
      <StoryWrapper
        data={{ contacts: [buildContact({ id: 1 })] }}
        initialEntries={["/?tab=tasks"]}
      >
        <ContactShow resource="contacts" id={1} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toHaveAttribute("aria-selected", "true");
  });

  it("shows an error when the contact cannot be loaded", async () => {
    const screen = await render(
      <StoryWrapper data={{ contacts: [] }}>
        {/* An id no other test loads, so no persisted query cache can serve it */}
        <ContactShow resource="contacts" id={404} />
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByText("Error loading contact"))
      .toBeVisible();
  });

  it("keeps showing a loaded contact when refreshing it fails", async () => {
    const contact = buildContact({ id: 405 });
    const baseDataProvider = createDataProvider({
      db: createCrmDb({ contacts: [contact] }),
      silent: true,
    });
    let isOffline = false;
    let refetchQueries: (() => Promise<void>) | null = null;

    const QueryClientListener = () => {
      const queryClient = useQueryClient();
      refetchQueries = () => queryClient.refetchQueries();
      return null;
    };

    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] }}
        dataProvider={{
          getOne: (resource, params) =>
            isOffline && resource === "contacts"
              ? Promise.reject(new Error("Failed to fetch"))
              : baseDataProvider.getOne(resource, params),
        }}
      >
        <QueryClientListener />
        <ContactShow resource="contacts" id={contact.id} />
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();

    isOffline = true;
    await refetchQueries!();

    await expect
      .element(screen.getByText("Error loading contact"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("tab", { name: "0 tasks" }))
      .toBeVisible();
  });

  it("shows the contact profile fields and history instead of the legacy status", async () => {
    mockIsMobile.mockReturnValue(false);

    const contact = buildContact({
      attitude: "friendly",
      birthday: "1985-03-12",
      communication_style: "D",
      contact_type: "channel",
      education: [
        {
          degree: "bachelor",
          end_year: 2007,
          major: "Hospitality",
          school: "Cornell University",
          start_year: 2003,
        },
      ],
      social_organization: "alumni",
      status: "warm",
      tenure_years: 3.5,
      work_experience: [
        {
          company: "Acme Hotels",
          end_year: 2020,
          start_year: 2015,
          title: "Director",
        },
      ],
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [contact] }}>
        <ResourceContextProvider value="contacts">
          <ShowBase id={contact.id}>
            <ContactAside />
          </ShowBase>
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Channel")).toBeVisible();
    await expect.element(screen.getByText("Friendly")).toBeVisible();
    await expect.element(screen.getByText("March 12, 1985")).toBeVisible();
    await expect.element(screen.getByText("D - Dominance")).toBeVisible();
    await expect.element(screen.getByText("3.5")).toBeVisible();
    await expect.element(screen.getByText("Alumni association")).toBeVisible();
    await expect
      .element(screen.getByText("Acme Hotels · Director"))
      .toBeVisible();
    await expect.element(screen.getByText("2015 – 2020")).toBeVisible();
    await expect
      .element(screen.getByText("Cornell University · Hospitality"))
      .toBeVisible();
    await expect
      .element(screen.getByText("2003 – 2007 · Bachelor"))
      .toBeVisible();

    // The legacy "cold/warm/hot" temperature is no longer a contact field
    expect(screen.getByText("Warm").all()).toHaveLength(0);
  });
});
