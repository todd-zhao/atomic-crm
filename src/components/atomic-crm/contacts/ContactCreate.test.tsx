import { render } from "vitest-browser-react";

import { ContactCreateBasic } from "./ContactCreate.stories";
import { page } from "vitest/browser";

describe("ContactCreate", () => {
  beforeAll(() => {
    page.viewport(1600, 900);
  });
  it("shows empty email and phone placeholder inputs", async () => {
    const screen = await render(<ContactCreateBasic />);

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();
    await expect
      .element(screen.getByPlaceholder("Phone number"))
      .toBeInTheDocument();
  });

  it("does not submit empty email and phone entries", async () => {
    const createMock = vi
      .fn()
      .mockImplementation(async (resource: string, params: any) => {
        if (resource === "contacts") {
          return { data: { id: 1, ...params.data } as any };
        }
      });

    const screen = await render(
      <ContactCreateBasic silent dataProvider={{ create: createMock }} />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields only
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .poll(() => screen.getByText("Element created"))
      .toBeInTheDocument();
    await screen.getByLabelText("Close toast").click();

    await expect(createMock).toBeCalledTimes(1);

    await expect(createMock).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          email_jsonb: null,
          phone_jsonb: null,
        }),
      }),
    );
  });

  it("submits only filled email and phone entries, stripping empty ones", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <ContactCreateBasic
        dataProvider={{
          create: createMock,
        }}
        silent
      />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    // Fill email but leave phone empty
    await screen.getByPlaceholder("Email").fill("ada@example.com");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock).toBeCalledTimes(1);

    expect(createMock).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          email_jsonb: [{ email: "ada@example.com", type: "Work" }],
          phone_jsonb: null,
        }),
      }),
    );
  });

  it("submits both email and phone when filled", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });

    const screen = await render(
      <ContactCreateBasic
        silent
        dataProvider={{
          create: createMock,
        }}
      />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    // Fill required fields
    await screen.getByLabelText(/first name/i).fill("Ada");
    await screen.getByLabelText(/last name/i).fill("Lovelace");

    // Fill both email and phone
    await screen.getByPlaceholder("Email").fill("ada@example.com");
    await screen.getByPlaceholder("Phone number").fill("+1234567890");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock).toBeCalledTimes(1);

    expect(createMock).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          email_jsonb: [{ email: "ada@example.com", type: "Work" }],
          phone_jsonb: [{ number: "+1234567890", type: "Work" }],
        }),
      }),
    );
  });

  it("accepts a full name without the legacy first and last names", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <ContactCreateBasic silent dataProvider={{ create: createMock }} />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    await screen.getByLabelText(/full name/i).fill("张伟");
    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock).toBeCalledTimes(1);

    expect(createMock).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ name: "张伟" }),
      }),
    );
  });

  it("rejects a contact with neither a full name nor first and last names", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <ContactCreateBasic silent dataProvider={{ create: createMock }} />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .element(screen.getByText("Add a full name, or a first and last name."))
      .toBeVisible();
    expect(createMock).not.toBeCalled();
  });

  it("does not let the email autofill overwrite a filled full name", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <ContactCreateBasic silent dataProvider={{ create: createMock }} />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    await screen.getByLabelText(/full name/i).fill("张伟");
    await screen.getByPlaceholder("Email").fill("ada.lovelace@example.com");

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock).toBeCalledTimes(1);

    const { data } = createMock.mock.calls[0][1];
    expect(data.name).toBe("张伟");
    expect(data.first_name).not.toBe("Ada");
    expect(data.last_name).not.toBe("Lovelace");
  });

  it("submits the CRM profile fields and the repeatable history", async () => {
    const createMock = vi.fn().mockResolvedValue({ data: {} });
    const screen = await render(
      <ContactCreateBasic silent dataProvider={{ create: createMock }} />,
    );

    await expect.element(screen.getByPlaceholder("Email")).toBeInTheDocument();

    await screen.getByLabelText(/full name/i).fill("张伟");
    await screen.getByRole("radio", { name: "Channel" }).click();
    await screen.getByLabelText("Birthday").fill("1985-03-12");
    await screen.getByRole("radio", { name: "D - Dominance" }).click();
    await screen.getByRole("radio", { name: "Friendly" }).click();
    await screen.getByLabelText("Years at company").fill("3.5");

    await screen.getByRole("combobox", { name: "Social organization" }).click();
    await screen.getByRole("option", { name: "Alumni association" }).click();

    const workExperience = screen.getByRole("group", {
      name: "Work experience",
    });
    await workExperience.getByRole("button", { name: "Add" }).click();
    await workExperience.getByLabelText("Start year").fill("2015");
    await workExperience.getByLabelText("End year").fill("2020");
    await workExperience.getByLabelText("Company").fill("Acme Hotels");
    await workExperience.getByLabelText("Title").fill("Director");

    const education = screen.getByRole("group", { name: "Education" });
    await education.getByRole("button", { name: "Add" }).click();
    await education.getByLabelText("Start year").fill("2003");
    await education.getByLabelText("End year").fill("2007");
    await education.getByLabelText("School").fill("Cornell University");
    await education.getByLabelText("Major").fill("Hospitality");
    await education.getByRole("combobox", { name: "Degree" }).click();
    await screen.getByRole("option", { name: "Bachelor" }).click();

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => createMock).toBeCalledTimes(1);

    expect(createMock).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({
          contact_type: "channel",
          birthday: "1985-03-12",
          communication_style: "D",
          attitude: "friendly",
          tenure_years: 3.5,
          social_organization: "alumni",
          work_experience: [
            {
              start_year: 2015,
              end_year: 2020,
              company: "Acme Hotels",
              title: "Director",
            },
          ],
          education: [
            {
              start_year: 2003,
              end_year: 2007,
              school: "Cornell University",
              major: "Hospitality",
              degree: "bachelor",
            },
          ],
        }),
      }),
    );
  });
});
