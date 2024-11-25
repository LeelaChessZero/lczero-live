export class AudioPlayer {
  private move : HTMLAudioElement;

  constructor() {
    this.move = new Audio('static/public_sound_standard_Move.mp3');
  }

  public playMoveAudio(): void {
    try {
      this.move.play();
    } catch (e) {
      // Need user interaction to play audio
    }
  }
}