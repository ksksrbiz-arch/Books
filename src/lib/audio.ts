export type AudioMood = 'romance' | 'crime' | 'paranormal' | 'mystery' | 'thriller' | 'ethereal' | 'noir' | 'none';

class SoundscapeManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nodes: (OscillatorNode | AudioBufferSourceNode | BiquadFilterNode | GainNode)[] = [];
  private isMuted: boolean = true; // start muted, user must interact
  private currentMood: AudioMood = 'none';

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 0.5;
    this.masterGain.connect(this.ctx.destination);
  }

  toggleMute() {
    this.init(); // ensure init
    this.isMuted = !this.isMuted;
    
    if (this.masterGain && this.ctx) {
      if (this.ctx.state === 'suspended' && !this.isMuted) {
         this.ctx.resume();
      }
      // smoothly ramp to avoid clicking
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.5, this.ctx.currentTime, 0.5);
    }
    return this.isMuted;
  }

  getMuted() {
    return this.isMuted;
  }

  setMood(mood: AudioMood) {
    if (mood === this.currentMood) return;
    this.currentMood = mood;
    this.stopAndClear();
    this.init();

    if (!this.ctx) return;

    if (this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume();
    }

    switch (mood) {
      case 'romance':
        // Warm, glowing chords
        this.createDrone([261.63, 329.63, 392.00, 523.25], 'sine', 0.1, 800); 
        this.createNoise('pink', 0.005, 3000); 
        break;
      case 'crime':
      case 'noir':
      case 'thriller':
        // Dark, tense rumble with rain-like noise
        this.createDrone([65.41, 73.42, 98.00], 'sawtooth', 0.05, 300); 
        this.createNoise('brown', 0.04, 500); 
        break;
      case 'paranormal':
      case 'ethereal':
      case 'mystery':
        // Ethereal minor drone with high air
        this.createDrone([130.81, 155.56, 196.00, 261.63], 'triangle', 0.08, 600); 
        this.createNoise('pink', 0.015, 2000); 
        break;
      default:
        // neutral/ambient base if just genre is chosen and no specific mood yet
        this.createDrone([196.00, 293.66], 'sine', 0.05, 500);
        break;
    }
  }

  private stopAndClear() {
    this.nodes.forEach(n => {
      try {
        if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) {
          n.stop();
        }
        n.disconnect();
      } catch (e) {}
    });
    this.nodes = [];
  }

  private createDrone(freqs: number[], type: OscillatorType, maxGain: number, cutoff: number) {
    if (!this.ctx || !this.masterGain) return;

    freqs.forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const filter = this.ctx!.createBiquadFilter();

      osc.type = type;
      osc.frequency.value = freq;
      
      // Detune slightly for chorus effect
      osc.detune.value = (Math.random() - 0.5) * 15;

      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      
      // LFO for filter/volume modulation to make it "breathe"
      const lfo = this.ctx!.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.02 + Math.random() * 0.04; // very slow
      const lfoGain = this.ctx!.createGain();
      lfoGain.gain.value = maxGain * 0.6;
      
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      
      gain.gain.value = maxGain * 0.4;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      osc.start();
      lfo.start();

      this.nodes.push(osc, gain, filter, lfo, lfoGain);
    });
  }

  private createNoise(color: 'brown' | 'pink', gainVal: number, cutoff: number = 1000) {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (color === 'brown') {
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.5;
      } else {
        // pink approximation
        lastOut = lastOut * 0.9 + white * 0.1;
        data[i] = lastOut;
      }
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;

    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
    this.nodes.push(noise, filter, gain);
  }
}

export const audioManager = new SoundscapeManager();
