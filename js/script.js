const heroBg = document.querySelector(".hero-bg");

window.addEventListener("scroll", () => {

    const scroll = window.scrollY;

    heroBg.style.transform = `translateY(${scroll * 0.25}px)`;

});