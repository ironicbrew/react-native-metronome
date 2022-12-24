/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * Generated with the TypeScript template
 * https://github.com/react-native-community/react-native-template-typescript
 *
 * @format
 */

import React, {useEffect} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import MetronomeModule from 'react-native-metronome-module';

import {Colors} from 'react-native/Libraries/NewAppScreen';

const App = () => {
  const isDarkMode = useColorScheme() === 'dark';

  const backgroundStyle = {
    backgroundColor: isDarkMode ? Colors.darker : Colors.lighter,
  };

  useEffect(() => {
    start();
    return () => MetronomeModule.stop();
  }, []);

  async function start() {
    MetronomeModule.setBPM(100);
    MetronomeModule.setShouldPauseOnLostFocus(true);
    MetronomeModule.start();

    if (await MetronomeModule.isPlaying()) {
      const bpm = await MetronomeModule.getBPM();
      console.log(`Metronome playing at ${bpm}bpm!`);
    }
  }

  return (
    <SafeAreaView style={backgroundStyle}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundStyle.backgroundColor}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={backgroundStyle}>
        <View
          style={{
            backgroundColor: isDarkMode ? Colors.black : Colors.white,
          }}>
          <Text>Metronome</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;
