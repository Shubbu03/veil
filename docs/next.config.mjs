import nextra from "nextra";

const withNextra = nextra({
  theme: "nextra-theme-docs",
  themeConfig: "./theme.config.tsx",
  defaultShowCopyCode: true,
});

export default withNextra({
  typescript: {
    // Next 15's generated pages validator incorrectly treats Nextra _meta files as routes.
    ignoreBuildErrors: true,
  },
});
