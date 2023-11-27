import * as Tone from "tone";
import { observer } from "mobx-react";
import { useRootStore, RootStoreProvider } from "../stores/RootStore";
import React, { useState, useEffect } from "react";
import {
  MenuItem,
  Slider,
  InputLabel,
  Button,
  Select,
} from "@material-ui/core";

const AudioEngine: React.FC = () => {
  const { instruments, settings } = useRootStore();

  const windowSize = 100; // for a 5-second window at 50ms per reading
  const [heartRates, setHeartRates] = useState([]);
  const [averageHeartRate, setAverageHeartRate] = useState(60);
  let beat = 0;
  let totalNotes = 8;
  Tone.start();

  const makeSynths = (count: number): Tone.Synth[] => {
    const synths: Tone.Synth[] = [];
    let oscillator: Tone.OscillatorType;
    for (let i = 0; i < count; i++) {
      if (settings.customVoice === true) {
        oscillator = settings.oscillator;
      } else {
        oscillator = settings.voice as Tone.OscillatorType;
      }
      let synth = new Tone.Synth({
        oscillator: oscillator,
      }).toDestination();
      synths.push(synth);
    }

    return synths;
  };

  const synths = makeSynths(Object.keys(instruments).length);
  const configLoop = () => {
    let duration = totalNotes + "n";
    let maxNotes: number[] = [];
    Object.values(instruments).forEach((instrument) => {
      if (instrument.display) {
        maxNotes.push(instrument.notes);
      }
    });
    totalNotes = Math.max(...maxNotes);

    const repeat = (time: number) => {
      Tone.getDestination().volume.rampTo(-Infinity, 0.001);
      Object.values(instruments).forEach((instrument, idx) => {
        let synth = synths[idx];
        let note = instrument.rhythm[beat];
        if (note && instrument.display) {
          synth.oscillator.type = settings.voice as Tone.OscillatorType;
          Tone.getDestination().volume.rampTo(settings.volume, 0.001);
          synth.triggerAttackRelease(instrument.audio, duration, time);
        }
      });

      beat = (beat + 1) % totalNotes;
      settings.beat = beat;
      settings.totalNotes = totalNotes;
      Tone.getDestination().volume.rampTo(settings.volume, 0.001);
      Tone.Transport.bpm.value = settings.tempo;
    };

    Tone.Transport.scheduleRepeat(repeat, duration);
  };

  const convertRange = (
    value: number,
    inputRange: number[],
    outputRange: number[]
  ): number => {
    return Math.floor(
      ((value - inputRange[0]) * (outputRange[1] - outputRange[0])) /
        (inputRange[1] - inputRange[0]) +
        outputRange[0]
    );
  };

  const handlePlay = () => {
    if (!settings.started) {
      Tone.start();
      Tone.getDestination().volume.rampTo(settings.volume, 0.001);
      configLoop();
      settings.started = true;
    }

    if (settings.playing) {
      Tone.Transport.stop();
      document.getElementById("playButton")!.innerHTML = "Start";
      settings.playing = false;
    } else {
      Tone.Transport.start();
      settings.playing = true;
      document.getElementById("playButton")!.innerHTML = "Stop";
    }
  };

  async function connectAndReadBLE() {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["heart_rate"] }],
      });

      const server = await device.gatt.connect();
      const services = await server.getPrimaryServices("heart_rate");
      const characteristics = await Promise.all(
        services.map(async (service) => await service.getCharacteristics())
      );

      // characteristics[0][0] is the pulse signal and characteristics[0][1] is the average pulse
      const pulseCharacteristic = characteristics[0][0];

      console.log(pulseCharacteristic);

      // Read pulse signal every 1 second and update settings.tempo
      setInterval(async () => {
        const value = await pulseCharacteristic.readValue();
        console.log("pulse value: ", value.getUint8(1));
        settings.tempo = Math.max(Math.floor(value.getUint8(1)), 40);
      }, 5000);
    } catch (error) {
      console.log(error);
    }
  }

  // update settings.tempo to averageHeartRate every 5 seconds
  /*  useEffect(() => {
    //    settings.tempo = Math.max(Math.floor(averageHeartRate), 40);
    console.log("tempo updated to: ", settings.tempo);
  }, [averageHeartRate]);

  // update averageHeartRate every 50ms
  useEffect(() => {
    const interval = setInterval(() => {
      const sum = heartRates.reduce((a, b) => a + b, 0);
      const avg = sum / heartRates.length || 0;
      setAverageHeartRate(avg);
    }, 50);
    return () => clearInterval(interval);
  }, [heartRates]);
 */
  return (
    <RootStoreProvider instruments={instruments} settings={settings}>
      <div className="bluetoothControl">
        {" "}
        <button onClick={() => connectAndReadBLE()}>
          Connect to BLE Device
        </button>
        <h2>Average Heart Rate (Last 5s): {averageHeartRate.toFixed(2)} BPM</h2>
      </div>
      <div className="mainControlPanel">
        <Button
          variant="contained"
          className="playButton"
          id="playButton"
          aria-label={settings.playing ? "Stop Playback" : "Start Playback"}
          title={settings.playing ? "Stop Playback" : "Start Playback"}
          onClick={() => handlePlay()}
        >
          Start
        </Button>
        <div className="voiceSelect">
          <div className={`control-item`}>
            <Select
              className="voiceSelect"
              displayEmpty={true}
              label="Voice"
              defaultValue={"default"}
              aria-label={`Select instrument voice`}
              title={`Select instrument voice`}
              onChange={(e) => {
                if (e.target.value === "default") {
                  settings.voice = "sine3";
                } else {
                  settings.voice = e.target.value;
                }
              }}
            >
              <MenuItem value={"default"}>
                <em>Select Voice</em>
              </MenuItem>
              <MenuItem aria-label={`Sine wave`} value={"sine"}>
                Sine
              </MenuItem>
              <MenuItem aria-label={`Fat sine wave`} value={"fatsine8"}>
                Fat Sine
              </MenuItem>
              <MenuItem aria-label={`Square wave`} value={"square5"}>
                Square
              </MenuItem>
              <MenuItem aria-label={`Sawtooth wave`} value={"sawtooth8"}>
                Sawtooth
              </MenuItem>
              <MenuItem aria-label={`Triangle wave`} value={"triangle3"}>
                Triangle
              </MenuItem>
              <MenuItem aria-label={`Pulse`} value={"pulse"}>
                Pulse
              </MenuItem>
              {/* <MenuItem value={'custom'}>Custom</MenuItem> */}
            </Select>
          </div>
          <div className={`wave-shaper control-item`}>
            <Select
              className="baseTypeSelect"
              displayEmpty={true}
              aria-label={`Base Type`}
              label="Base Type"
              defaultValue={"pwm"}
              onChange={(e) => {
                console.log("should update oscillator");
              }}
            >
              <MenuItem value={"pwm"}>
                <em>Pulse Wave Modulation</em>
              </MenuItem>
              <MenuItem value={"pulse"}>Pulse</MenuItem>
            </Select>
          </div>
        </div>
        <div className="tempoControl">
          <InputLabel sx={{ mb: 1.5, marginTop: "20px" }}>
            Tempo: {settings.tempo}
          </InputLabel>
        </div>
        <div className="volumeControl">
          <Slider
            size="small"
            defaultValue={convertRange(settings.volume, [-30, -10], [0, 100])}
            aria-label={`Volume`}
            min={0}
            label="Volume"
            max={100}
            valueLabelDisplay="auto"
            onChange={(e, val) => {
              val = convertRange(val as number, [0, 100], [-30, -10]);
              settings.volume = val;
            }}
          />
          <InputLabel sx={{ mb: 1.5, marginTop: "20px" }}>Volume</InputLabel>
        </div>
      </div>
    </RootStoreProvider>
  );
};

export default observer(AudioEngine);
