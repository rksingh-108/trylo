/**
 * No "use client" here on purpose: this must stay callable from a Server
 * Component (the root layout) so its output can be inlined as a <script>
 * that runs before hydration, avoiding a flash of the wrong theme.
 */
export function themeInitScript(storageKey = "trylo-theme") {
  return `(function(){try{var k="${storageKey}";var t=localStorage.getItem(k)||"system";var s=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var r=t==="system"?s:t;document.documentElement.classList.add(r);document.documentElement.style.colorScheme=r;}catch(e){}})();`;
}
