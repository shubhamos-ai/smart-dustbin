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

// Fetch system status from API
async function fetchSystemStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        // Update connection status
        updateConnectionStatus(data.connection_status === 'Online');

        // Get current state
        const systemState = data.systemState || 'IDLE';
        const wasteType = data.lastWaste;

        // Update bin full indicators (visual only, no blocking)
        updateBinStatus(data.wetFull, data.dryFull);

        // Handle state changes
        if (systemState !== currentSystemState) {
            console.log(`State change: ${currentSystemState} → ${systemState}`);
            currentSystemState = systemState;

            // Update UI for new state
            updateSystemState(systemState, wasteType);

            // Trigger animations based on state transitions
            handleStateTransition(systemState, wasteType);
        }

    } catch (error) {
        console.error('Error fetching status:', error);
        updateConnectionStatus(false);
        currentSystemState = 'OFFLINE';
        updateSystemState('OFFLINE');
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

    // Randomize icons for variety
    const wetIcons = ['fa-apple-whole', 'fa-leaf', 'fa-carrot', 'fa-fish'];
    const dryIcons = ['fa-newspaper', 'fa-box-open', 'fa-bottle-water', 'fa-cube'];

    if (isWet) {
        const randomIcon = wetIcons[Math.floor(Math.random() * wetIcons.length)];
        iconElement.classList.add(randomIcon);
    } else {
        const randomIcon = dryIcons[Math.floor(Math.random() * dryIcons.length)];
        iconElement.classList.add(randomIcon);
    }

    // Trigger particle animation
    elements.particle.className = 'waste-particle ' + particleClass;

    // Wait for animation to complete
    await sleep(1500);

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
    console.log('📡 Polling Firebase every 200ms for real-time updates');

    // Initial fetch
    fetchSystemStatus();

    // Poll every 200ms for responsive detection
    setInterval(fetchSystemStatus, 200);
}

// Start the application
init();
