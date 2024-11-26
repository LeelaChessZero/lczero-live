export enum AudioEventType {
  MOVE,
}

class DebouncedAudioPlayer {
  private audioContext : AudioContext;
  private audio: AudioBuffer;
  private cooldown: number;
  private lastPlayed: number;

  constructor(context: AudioContext, audio: AudioBuffer, cooldown: number = 0) {
    this.audioContext = context;
    this.audio = audio;
    this.cooldown = cooldown;
    this.lastPlayed = 0;
  }

  public play() {
    const now = Date.now();
    if (now - this.lastPlayed < this.cooldown) {
      return;
    }
    this.lastPlayed = now;

    this.audioContext.resume();
    if (this.audioContext.state !== "running") {
      return;
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = this.audio;
    source.connect(this.audioContext.destination);
    source.start(0);
  }
}

export class AudioPlayer {
  private sounds: Map<AudioEventType, DebouncedAudioPlayer>;

  constructor() {
    this.sounds = new Map();
    const context = new AudioContext();
    this.addSound(context, AudioEventType.MOVE, 'static/public_sound_standard_Move.mp3');
  }

  private async addSound(context: AudioContext, eventType: AudioEventType, path: string): Promise<void> { 
    const moveSound = await this.loadSound(context, path);
    this.sounds.set(eventType, new DebouncedAudioPlayer(context, moveSound, 50));
  }

  private async loadSound(context: AudioContext, url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }

  public playAudio(eventType: AudioEventType): void {
    try {
      this.sounds.get(eventType)?.play();
    } catch (e) {
      // Need user interaction to play audio
    }
  }
}