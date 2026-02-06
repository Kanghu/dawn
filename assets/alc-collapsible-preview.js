if (!customElements.get('alc-collapsible-preview')) {
  customElements.define(
    'alc-collapsible-preview',
    class AlcCollapsiblePreview extends HTMLElement {
      constructor() {
        super();
        this.previewContainer = null;
        this.toggleButton = null;
        this.showMoreLabel = null;
        this.showLessLabel = null;
        this.gradientOverlay = null;
        this.isExpanded = false;
      }

      connectedCallback() {
        this.previewContainer = this.querySelector('.accordion__content-preview');
        this.toggleButton = this.querySelector('.accordion__see-more-btn');
        this.showMoreLabel = this.querySelector('.see-more-label');
        this.showLessLabel = this.querySelector('.see-less-label');
        this.gradientOverlay = this.querySelector('.accordion__gradient-overlay');

        if (!this.previewContainer || !this.toggleButton) return;

        // Initialize in collapsed state
        this.setCollapsedState();

        // Check if content is shorter than preview height (no need for toggle)
        this.checkContentHeight();

        // Bind click event
        this.toggleButton.addEventListener('click', this.handleToggle.bind(this));

        // Handle keyboard navigation
        this.toggleButton.addEventListener('keydown', this.handleKeydown.bind(this));
      }

      checkContentHeight() {
        const contentInner = this.querySelector('.accordion__content');
        if (!contentInner) return;

        const contentHeight = contentInner.scrollHeight;
        const previewHeight = window.innerWidth <= 749 ? 200 : 250;

        // If content is shorter than preview height, hide button and gradient
        if (contentHeight <= previewHeight) {
          this.toggleButton.style.display = 'none';
          if (this.gradientOverlay) {
            this.gradientOverlay.style.display = 'none';
          }
          this.previewContainer.classList.remove('is-collapsed');
          this.previewContainer.classList.add('is-expanded');
        }
      }

      handleToggle(event) {
        event.preventDefault();
        this.isExpanded = !this.isExpanded;

        if (this.isExpanded) {
          this.setExpandedState();
        } else {
          this.setCollapsedState();
        }
      }

      handleKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.handleToggle(event);
        }
      }

      setExpandedState() {
        this.previewContainer.classList.remove('is-collapsed');
        this.previewContainer.classList.add('is-expanded');
        this.toggleButton.setAttribute('aria-expanded', 'true');
        if (this.showMoreLabel) this.showMoreLabel.classList.add('hidden');
        if (this.showLessLabel) this.showLessLabel.classList.remove('hidden');
      }

      setCollapsedState() {
        this.previewContainer.classList.remove('is-expanded');
        this.previewContainer.classList.add('is-collapsed');
        this.toggleButton.setAttribute('aria-expanded', 'false');
        if (this.showMoreLabel) this.showMoreLabel.classList.remove('hidden');
        if (this.showLessLabel) this.showLessLabel.classList.add('hidden');
      }

      disconnectedCallback() {
        if (this.toggleButton) {
          this.toggleButton.removeEventListener('click', this.handleToggle.bind(this));
          this.toggleButton.removeEventListener('keydown', this.handleKeydown.bind(this));
        }
      }
    }
  );
}
