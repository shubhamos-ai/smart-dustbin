// DOM Elements
const elements = {
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.getElementById('statusText'),
    mainStatus: document.getElementById('mainStatus'),
    subStatus: document.getElementById('subStatus'),
    wetBin: document.getElementById('wetBin'),
    dryBin: document.getElementById('dryBin'),
    particle: document.getElementById('wasteParticle')
};

// State tracking
let currentSystemState = 'IDLE';
let lastWasteType = null;
let isAnimating = false;

// System state messages mapping
const STATE_MESSAGES = {
    'BOOTED': {
        main: 'SYSTEM BOOTING',
        sub: 'Initializing sensors...'
    },
    'IDLE': {
        main: 'SYSTEM READY',
        sub: 'Awaiting waste detection...'
    },
    'OBJECT_DETECTED': {
        main: 'OBJECT DETECTED',
        sub: 'Preparing to analyze...'
    },
    'ANALYZING': {
        main: 'ANALYZING WASTE',
        sub: 'Reading moisture sensors...'
    },
    'SORTING': {
        main: 'SORTING IN PROGRESS',
        sub: 'Directing waste to bin...'
    },
    'CHECKING_BINS': {
        main: 'CHECKING BINS',
        sub: 'Verifying bin capacity...'
    },
    'COOLDOWN': {
        main: 'COOLDOWN',
        sub: 'Resetting for next item...'
    },
    'OFFLINE': {
        main: 'SYSTEM OFFLINE',
        sub: 'Waiting for connection...'
    }
};

// Update connection status
function updateConnectionStatus(isOnline) {
    if (isOnline) {
        elements.statusBadge.classList.add('online');
        elements.statusText.textContent = 'ONLINE';
    } else {
        elements.statusBadge.classList.remove('online');
        elements.statusText.textContent = 'OFFLINE';
    }
}

// Update UI based on system state
function updateSystemState(state, wasteType = null) {
    const messages = STATE_MESSAGES[state] || STATE_MESSAGES['IDLE'];

    elements.mainStatus.textContent = messages.main;
    elements.subStatus.textContent = messages.sub;

    // Update visual state based on system state
    switch (state) {
        case 'IDLE':
        case 'BOOTED':
            document.body.className = '';
            elements.wetBin.className = 'bin-card';
            elements.dryBin.className = 'bin-card';
            break;

        case 'OBJECT_DETECTED':
            // Subtle pulse on both bins
            document.body.className = 'detecting';
            break;

        case 'ANALYZING':
            // Show analyzing state
            document.body.className = 'analyzing';
            break;

        case 'SORTING':
            // Activate the correct bin based on waste type
            if (wasteType === 'WET') {
                document.body.className = 'detecting-wet';
                elements.wetBin.className = 'bin-card active wet-active';
                elements.dryBin.className = 'bin-card';
            } else if (wasteType === 'DRY') {
                document.body.className = 'detecting-dry';
                elements.dryBin.className = 'bin-card active dry-active';
                elements.wetBin.className = 'bin-card';
            }
            break;

        case 'CHECKING_BINS':
            // Both bins highlighted briefly
            elements.wetBin.className = 'bin-card active';
            elements.dryBin.className = 'bin-card active';
            break;
    }
}

// Fetch system status from API with timeout
async function fetchSystemStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
        const response = await fetch('/api/status', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Update connection status
        updateConnectionStatus(data.connection_status === 'Online');

        // Hide loading overlay on first successful load
        const loader = document.getElementById('loadingOverlay');
        if (loader && !loader.classList.contains('hidden')) {
            loader.classList.add('hidden');
        }

        // Get current state
        const systemState = data.systemState || 'IDLE';
        const wasteType = data.lastWaste;

        // Update bin full indicators (visual only, no blocking)
        updateBinStatus(data.wetFull, data.dryFull);

        // Handle state changes
        // Check if state changed OR if we are sorting and the waste type changed (to trigger new animation)
        if (systemState !== currentSystemState || (systemState === 'SORTING' && wasteType !== lastWasteType)) {
            console.log(`State update: ${currentSystemState} -> ${systemState} | Waste: ${lastWasteType} -> ${wasteType}`);

            currentSystemState = systemState;
            lastWasteType = wasteType;

            // Update UI for new state
            updateSystemState(systemState, wasteType);

            // Trigger animations based on state transitions
            handleStateTransition(systemState, wasteType);
        }

    } catch (error) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            console.warn('Request timeout - server may be slow');
        } else {
            console.error('Error fetching status:', error);
        }

        updateConnectionStatus(false);

        // Only update to OFFLINE if we're not already offline
        if (currentSystemState !== 'OFFLINE') {
            currentSystemState = 'OFFLINE';
            updateSystemState('OFFLINE');
        }

        // Hide loader even on error so user isn't stuck
        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.classList.add('hidden');
    }
}

// Update bin status indicators
function updateBinStatus(wetFull, dryFull) {
    // You can add visual indicators here if needed
    // For now, we just track the state
    if (wetFull) {
        console.warn('⚠️ Wet bin is full!');
    }
    if (dryFull) {
        console.warn('⚠️ Dry bin is full!');
    }
}

// Handle state transitions with animations
async function handleStateTransition(newState, wasteType) {
    switch (newState) {
        case 'OBJECT_DETECTED':
            // Quick pulse animation
            playDetectionPulse();
            break;

        case 'ANALYZING':
            // Show scanning effect
            playAnalyzingEffect();
            break;

        case 'SORTING':
            // Trigger particle animation
            if (wasteType === 'WET' || wasteType === 'DRY') {
                await playParticleAnimation(wasteType);
            }
            break;

        case 'IDLE':
            // Reset animations
            resetAnimations();
            break;
    }
}

// Animation: Detection pulse
function playDetectionPulse() {
    // Add pulse class temporarily
    document.body.classList.add('pulse-effect');
    setTimeout(() => {
        document.body.classList.remove('pulse-effect');
    }, 500);
}

// Animation: Analyzing effect
function playAnalyzingEffect() {
    // Rotate rings faster during analysis
    document.body.classList.add('analyzing-active');
}

// Animation: Particle flying to bin
async function playParticleAnimation(wasteType) {
    if (isAnimating) return;
    isAnimating = true;

    const isWet = wasteType === 'WET';
    const particleClass = isWet ? 'animating-wet' : 'animating-dry';

    // Set the correct icon
    const iconElement = document.getElementById('particleIcon');
    // Reset icon classes
    iconElement.className = 'fa-solid';

    // Randomize icons for variety - prioritizing paper for Dry
    const wetIcons = ['fa-apple-whole', 'fa-carrot', 'fa-leaf', 'fa-fish', 'fa-lemon'];
    const dryIcons = ['fa-file', 'fa-note-sticky', 'fa-scroll', 'fa-newspaper', 'fa-box-open'];

    if (isWet) {
        const randomIcon = wetIcons[Math.floor(Math.random() * wetIcons.length)];
        iconElement.classList.add(randomIcon);
    } else {
        const randomIcon = dryIcons[Math.floor(Math.random() * dryIcons.length)];
        iconElement.classList.add(randomIcon);
    }

    // Trigger particle animation
    // The CSS animation is now 1.8s long (Realistic physics-based toss)
    elements.particle.className = 'waste-particle ' + particleClass;

    // Visual feedback on Hub (Pulse)
    const hubCore = document.querySelector('.hub-core');
    if (hubCore) {
        hubCore.style.transform = 'scale(0.95)';
        setTimeout(() => hubCore.style.transform = 'scale(1)', 200);
    }

    // Wait for animation to complete (1.8s + buffer)
    await sleep(1900);

    isAnimating = false;
}

// Reset all animations
function resetAnimations() {
    document.body.classList.remove('analyzing-active', 'pulse-effect');
    elements.particle.className = 'waste-particle';
}

// Helper: Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize and start polling
function init() {
    console.log('🚀 Smart Waste Management System initialized');

    // Start the polling loop
    pollSystemStatus();
}

// Polling loop with backpressure protection
async function pollSystemStatus() {
    await fetchSystemStatus();

    // Schedule next poll only after current one finishes
    setTimeout(pollSystemStatus, 1000);
}

// Start the application
init();
