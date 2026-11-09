/** Validation for the URL fields of both company directories. */
export const isUrl = (url: string) => {
  if (!url) return;
  const UrlRegex = new RegExp(
    /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([-.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i,
  );
  if (!UrlRegex.test(url)) {
    return {
      message: "crm.validation.invalid_url",
      args: { _: "Must be a valid URL" },
    };
  }
};
