// DOM Elements
const elements = {
    statusBadge: document.getElementById('statusBadge'),
    statusText: document.getElementById('statusText'),
    mainStatus: document.getElementById('mainStatus'),
    subStatus: document.getElementById('subStatus'),
    wetBin: document.getElementById('wetBin'),
    dryBin: document.getElementById('dryBin'),
    particle: document.getElementById('wasteParticle'),
    particleIcon: document.getElementById('particleIcon')
};

// State tracking
let currentSystemState = 'IDLE';
let lastWasteType = null;
let isAnimating = false;

// System state messages mapping
const STATE_MESSAGES = {
    'BOOTED': {
        main: 'SYSTEM INITIALIZATION',
        sub: 'Calibrating smart sensors...'
    },
    'IDLE': {
        main: 'SYSTEM ACTIVE',
        sub: 'Ready for automated segregation...'
    },
    'OBJECT_DETECTED': {
        main: 'OBJECT IDENTIFIED',
        sub: 'Verifying material properties...'
    },
    'ANALYZING': {
        main: 'PROCESSING ANALYSIS',
        sub: 'Evaluating moisture levels...'
    },
    'SORTING': {
        main: 'SEGREGATING',
        sub: 'Optimizing waste placement...'
    },
    'CHECKING_BINS': {
        main: 'CAPACITY CHECK',
        sub: 'Scanning bin fill levels...'
    },
    'COOLDOWN': {
        main: 'SYSTEM RESET',
        sub: 'Preparing for next cycle...'
    },
    'OFFLINE': {
        main: 'SYSTEM OFFLINE',
        sub: 'Syncing with network...'
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
            document.body.className = 'detecting';
            break;

        case 'ANALYZING':
            document.body.className = 'analyzing';
            break;

        case 'SORTING':
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
            elements.wetBin.className = 'bin-card active';
            elements.dryBin.className = 'bin-card active';
            break;
    }
}

// Fetch system status from API with timeout
async function fetchSystemStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch('/api/status', {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        updateConnectionStatus(data.connection_status === 'Online');

        const loader = document.getElementById('loadingOverlay');
        if (loader && !loader.classList.contains('hidden')) {
            loader.classList.add('hidden');
        }

        const systemState = data.systemState || 'IDLE';
        const wasteType = data.lastWaste;

        updateBinStatus(data.wetFull, data.dryFull);

        if (systemState !== currentSystemState || (systemState === 'SORTING' && wasteType !== lastWasteType)) {
            currentSystemState = systemState;
            lastWasteType = wasteType;
            updateSystemState(systemState, wasteType);
            handleStateTransition(systemState, wasteType);
        }

    } catch (error) {
        clearTimeout(timeoutId);
        updateConnectionStatus(false);

        if (currentSystemState !== 'OFFLINE') {
            currentSystemState = 'OFFLINE';
            updateSystemState('OFFLINE');
        }

        const loader = document.getElementById('loadingOverlay');
        if (loader) loader.classList.add('hidden');
    }
}

// Update bin status indicators
function updateBinStatus(wetFull, dryFull) {
    if (wetFull) console.warn('⚠️ Wet bin is full!');
    if (dryFull) console.warn('⚠️ Dry bin is full!');
}

// Handle state transitions with animations
async function handleStateTransition(newState, wasteType) {
    switch (newState) {
        case 'OBJECT_DETECTED':
            showTrashParticle();
            playDetectionPulse();
            break;

        case 'ANALYZING':
            showTrashParticle();
            playAnalyzingEffect();
            break;

        case 'SORTING':
            if (wasteType === 'WET' || wasteType === 'DRY') {
                await playParticleAnimation(wasteType);
            }
            break;

        case 'IDLE':
            resetAnimations();
            break;
    }
}

// Show the trash particle at the hub
function showTrashParticle() {
    elements.particle.classList.add('visible');
    if (!elements.particleIcon.className.includes('fa-')) {
        elements.particleIcon.className = 'fa-solid fa-trash-can';
    }
}

// Animation: Detection pulse
function playDetectionPulse() {
    document.body.classList.add('pulse-effect');
    setTimeout(() => {
        document.body.classList.remove('pulse-effect');
    }, 600);
}

// Animation: Analyzing effect (Hovering trash)
function playAnalyzingEffect() {
    document.body.classList.add('analyzing-active');
    elements.particle.classList.add('hovering');
}

// Animation: Particle flying to bin
async function playParticleAnimation(wasteType) {
    if (isAnimating) return;
    isAnimating = true;

    const isWet = wasteType === 'WET';
    const particleClass = isWet ? 'animating-wet' : 'animating-dry';

    elements.particle.classList.remove('hovering');

    if (isWet) {
        elements.particleIcon.className = 'fa-solid fa-apple-whole';
    } else {
        elements.particleIcon.className = 'fa-solid fa-bottle-water';
    }

    void elements.particle.offsetWidth;
    elements.particle.classList.add(particleClass);

    const hubCore = document.querySelector('.hub-core');
    if (hubCore) {
        hubCore.style.transform = 'scale(0.9) rotate(5deg)';
        setTimeout(() => hubCore.style.transform = 'scale(1) rotate(0deg)', 300);
    }

    await sleep(1900);
    isAnimating = false;
}

// Reset all animations
function resetAnimations() {
    document.body.classList.remove('analyzing-active', 'pulse-effect');
    elements.particle.className = 'waste-particle';
    elements.particleIcon.className = 'fa-solid fa-trash-can';
}

// Helper: Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Initialize and start polling
function init() {
    console.log('🚀 Smart Waste Management System initialized');
    pollSystemStatus();
}

// Polling loop with backpressure protection
async function pollSystemStatus() {
    await fetchSystemStatus();
    setTimeout(pollSystemStatus, 1000);
}

// Start the application
init();
