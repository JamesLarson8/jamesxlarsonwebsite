const animatedSections = document.querySelectorAll(".reveal, .stagger-grid");

if ("IntersectionObserver" in window && animatedSections.length > 0) {
  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        obs.unobserve(entry.target);
      });
    },
    {
      root: null,
      threshold: 0.18,
    }
  );

  animatedSections.forEach((section) => observer.observe(section));
} else {
  animatedSections.forEach((section) => section.classList.add("is-visible"));
}
