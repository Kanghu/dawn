/**
 * Light temperature (blocks/alc-light-temperature.liquid): the option buttons switch the photo. The
 * photos and the buttons are in the same order, so the n-th button shows the n-th photo.
 */
if (!customElements.get('alc-light-temperature')) {
  customElements.define(
    'alc-light-temperature',
    class AlcLightTemperature extends HTMLElement {
      connectedCallback() {
        if (this.options) return;
        this.options = Array.from(this.querySelectorAll('.alc-lt__option'));
        this.images = Array.from(this.querySelectorAll('.alc-lt__img'));
        this.options.forEach((option, index) => {
          option.addEventListener('click', () => this.select(index));
        });
      }

      select(index) {
        this.options.forEach((option, i) => option.setAttribute('aria-pressed', i === index ? 'true' : 'false'));
        this.images.forEach((image, i) => image.classList.toggle('is-active', i === index));
      }
    }
  );
}
