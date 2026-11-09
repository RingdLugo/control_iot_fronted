export class BubbleEffects {
  burstAt(x, y) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const burst = document.createElement("span");
    burst.className = "bubble-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.style.left = `${x}px`;
    burst.style.top = `${y}px`;
    for (let index = 0; index < 10; index += 1) {
      const bubble = document.createElement("span");
      const angle = (Math.PI * 2 * index) / 10 + Math.random() * .25;
      const distance = 30 + Math.random() * 54;
      bubble.className = "bubble-particle";
      bubble.style.setProperty("--bubble-x", `${Math.cos(angle) * distance}px`);
      bubble.style.setProperty("--bubble-y", `${Math.sin(angle) * distance}px`);
      bubble.style.setProperty("--bubble-size", `${7 + Math.random() * 12}px`);
      bubble.style.setProperty("--bubble-delay", `${Math.random() * 120}ms`);
      burst.append(bubble);
    }
    document.body.append(burst);
    window.setTimeout(() => burst.remove(), 1_250);
  }
  burstFromElement(element) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    this.burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
}
