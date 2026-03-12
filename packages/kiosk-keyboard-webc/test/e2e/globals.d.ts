/** Exposed by visual test pages for theme switching via browser.execute(). */
interface Window {
  __setTheme(theme: string): Promise<void>;
}
