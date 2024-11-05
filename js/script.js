// JavaScript for Modal Functionality

// Function to open a modal
function openModal(modal) {
    modal.style.display = "block";
    // Shift focus to the close button for accessibility
    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
        closeButton.focus();
    }
}

// Function to close a modal
function closeModal(modal) {
    modal.style.display = "none";
    // Pause any video playing within the modal
    const video = modal.querySelector('video');
    if (video) {
        video.pause();
    }
    // Return focus to the last focused element before opening the modal
    if (modal.lastFocusedElement) {
        modal.lastFocusedElement.focus();
    }
}

// Get all elements that can open a modal
const modalTriggers = document.querySelectorAll('[data-modal-target]');

modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent default link behavior
        const modal = document.querySelector(trigger.dataset.modalTarget);
        if (modal) {
            // Store the last focused element
            modal.lastFocusedElement = document.activeElement;
            openModal(modal);
        }
    });
});

// Get all elements that can close a modal
const closeButtons = document.querySelectorAll('.close-button');

closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        const modal = button.closest('.modal');
        if (modal) {
            closeModal(modal);
        }
    });

    // Allow closing modal with Enter key on close button
    button.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const modal = button.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        }
    });
});

// Close the modal when clicking outside of the modal content
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal(e.target);
    }
});

// Close the modal when pressing the 'Esc' key
window.addEventListener('keydown', (e) => {
    if (e.key === "Escape") {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === "block") {
                closeModal(modal);
            }
        });
    }
});
