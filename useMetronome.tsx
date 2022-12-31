import React, {useEffect} from 'react';
import MetronomeModule from 'react-native-metronome-module';

const useMetronome = () => {
  useEffect(() => {
    start();
  });

  async function start() {
    MetronomeModule.setBPM(100);
    MetronomeModule.setShouldPauseOnLostFocus(true);
    MetronomeModule.start();
    if (await MetronomeModule.isPlaying()) {
      const bpm = await MetronomeModule.getBPM();
      console.log(`Metronome playing at ${bpm}bpm!`);
    }
  }
};

export default useMetronome;
