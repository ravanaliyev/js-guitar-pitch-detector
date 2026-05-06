// Simple YIN pitch detection algorithm
function yinDetector(buffer, sampleRate, threshold = 0.1) {
    const bufferSize = buffer.length;
    const halfBufferSize = Math.floor(bufferSize / 2);
    const yinBuffer = new Array(halfBufferSize).fill(0);

    let runningSum = 0;
    for (let tau = 0; tau < halfBufferSize; tau++) {
        for (let i = 0; i < halfBufferSize; i++) {
            const delta = buffer[i] - buffer[i + tau];
            yinBuffer[tau] += delta * delta;
        }
        runningSum += yinBuffer[tau];
        yinBuffer[tau] *= tau / runningSum;
    }

    for (let tau = 2; tau < halfBufferSize; tau++) {
        if (yinBuffer[tau] < threshold) {
            let betterTau = tau;
            for (let i = tau + 1; i < halfBufferSize; i++) {
                if (yinBuffer[i] < yinBuffer[betterTau]) {
                    betterTau = i;
                }
            }
            if (betterTau !== tau) {
                return sampleRate / parabolicInterpolation(yinBuffer, betterTau);
            } else {
                return sampleRate / tau;
            }
        }
    }
    return 0;
}

function parabolicInterpolation(yinBuffer, tau) {
    const x1 = tau - 1;
    const x2 = tau;
    const x3 = tau + 1;
    if (x1 < 0 || x3 >= yinBuffer.length) return tau;
    const y1 = yinBuffer[x1];
    const y2 = yinBuffer[x2];
    const y3 = yinBuffer[x3];
    const a = (y1 - 2 * y2 + y3) / 2;
    const b = (y3 - y1) / 2;
    return x2 - b / (2 * a);
}

class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.pitchDetector = null;
        this.isRunning = false;
        this.animationId = null;
        this.lastFrequency = 0; // Keep previous frequency
        this.lastNote = '--';
        this.onNoteDetected = () => {}; // Callback function
    }

    async start() {
        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Create AnalyserNode
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.microphone.connect(this.analyser);

            // Use YIN algorithm
            this.pitchDetector = yinDetector;

            this.isRunning = true;
            this.animate();

        } catch (error) {
            console.error('Microphone access failed:', error);
            let message = 'Microphone access denied or not supported.';
            if (error.name === 'NotAllowedError') {
                message = 'Microphone permission denied. Please allow access.';
            } else if (error.name === 'NotFoundError') {
                message = 'Microphone not found. Check your microphone.';
            } else if (error.name === 'NotReadableError') {
                message = 'Microphone is being used by another application.';
            }
            alert(message);
        }
    }

    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        if (this.microphone) {
            this.microphone.disconnect();
        }
    }

    animate() {
        if (!this.isRunning) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);
        this.analyser.getFloatTimeDomainData(dataArray);

        // Calculate volume (RMS)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / bufferLength);
        const volume = rms * 100; // Percentage

        let frequency = 0;
        let note = '--';

        // Analyze if volume is sufficient
        if (volume > 1) { // Threshold, adjustable
            frequency = this.pitchDetector(dataArray, this.audioContext.sampleRate);
            if (frequency && frequency > 0) {
                note = this.frequencyToNote(frequency);
                this.lastFrequency = frequency; // Update
                this.lastNote = note;
            } else {
                frequency = this.lastFrequency; // Use previous
                note = this.lastNote;
            }
        }

        // Update elements
        this.onNoteDetected(frequency, note);

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    frequencyToNote(frequency) {
        const A4 = 440;
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Calculate MIDI note number
        const midiNote = Math.round(12 * Math.log2(frequency / A4)) + 69;

        // Octave and note name
        const noteIndex = midiNote % 12;
        const octave = Math.floor(midiNote / 12) - 1;

        return noteNames[noteIndex] + octave;
    }
}

// Usage
const processor = new AudioProcessor();

// Define callback function
processor.onNoteDetected = (frequency, note) => {
    document.getElementById('frekansKutusu').textContent = `Frequency: ${frequency.toFixed(2)} Hz`;
    document.getElementById('notaKutusu').textContent = `Note: ${note}`;
};

document.getElementById('baslatBtn').addEventListener('click', () => {
    if (!processor.isRunning) {
        processor.start();
        document.getElementById('baslatBtn').textContent = 'Stop';
    } else {
        processor.stop();
        document.getElementById('baslatBtn').textContent = 'Start Listening';
    }
});

/*
Usage Example:
const processor = new AudioProcessor();
processor.onNoteDetected = (freq, note) => {
    // DOM updates or other operations here
    console.log(`Frequency: ${freq} Hz, Note: ${note}`);
    // document.getElementById('someElement').textContent = `Note: ${note}`;
};
document.getElementById('startBtn').addEventListener('click', () => {
    processor.start();
});
*/