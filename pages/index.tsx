import {
  StartStreamTranscriptionCommand,
  StartStreamTranscriptionCommandOutput,
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";

import MicrophoneStream from "microphone-stream";
import Head from "next/head";
import React from "react";
import { useForm } from "react-hook-form";

interface Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

interface Options {
  region: string;
  credentials: Credentials;
  languageCode: string;
}

class ASRController {
  private micStream = MicrophoneStream;
  private client?: TranscribeStreamingClient;

  async *start(options: Options) {
    const { region, credentials, languageCode } = options;

    this.micStream = new MicrophoneStream();

    this.client = new TranscribeStreamingClient({
      region,
      credentials,
    });

    this.micStream.setStream(
      await window.navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      })
    );

    const micStream = this.micStream;
    const audioStream = async function*() {
      for await (const chunk of micStream) {
        yield {
          AudioEvent: {
            AudioChunk: pcmEncodeChunk(
              chunk
            ) /* pcm Encoding is optional depending on the source */,
          },
        };
      }
    };

    const command = new StartStreamTranscriptionCommand({
      // The language code for the input audio. Valid values are en-GB, en-US, es-US, fr-CA, and fr-FR
      LanguageCode: languageCode,
      // The encoding used for the input audio. The only valid value is pcm.
      MediaEncoding: "pcm",
      // The sample rate of the input audio in Hertz. We suggest that you use 8000 Hz for low-quality audio and 16000 Hz for
      // high-quality audio. The sample rate must match the sample rate in the audio file.
      MediaSampleRateHertz: 44100,
      AudioStream: audioStream(),
    });

    try {
      const response = await this.client.send(command);
      const responseStream = this.handleTranscribeEvents(response);

      for await (const transcripts of responseStream) {
        yield transcripts;
      }
    } catch (e) {
      if (e.name === "InternalFailureException") {
        /* handle InternalFailureException */
      } else if (e.name === "ConflictException") {
        /* handle ConflictException */
      }

      alert(`An error occured : [${e.name}] ${e.message}`);
    } finally {
      this.stop();
    }
  }

  async stop() {
    this.micStream.stop();
    this.client.destroy();
  }

  state(): AudioContext["state"] | null {
    return this.micStream?.context?.state;
  }

  private async *handleTranscribeEvents(
    response: StartStreamTranscriptionCommandOutput
  ) {
    for await (const event of response.TranscriptResultStream) {
      if (event.TranscriptEvent) {
        const results = event.TranscriptEvent.Transcript.Results;

        yield results
          .map((result) => {
            return (result.Alternatives || []).map((alternative) => {
              return alternative.Items.map((item) => item.Content).join(" ");
            });
          })
          .flat();
      }
    }
  }
}

const controller = new ASRController();

type Inputs = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
  languageCode: string;
};

export default function Home() {
  const [transcript, setTranscript] = React.useState("");
  const [started, setStarted] = React.useState(false);
  const { register, getValues } = useForm<Inputs>();

  const handleStart = React.useCallback(async () => {
    const {
      accessKeyId,
      languageCode,
      region,
      secretAccessKey,
      sessionToken,
    } = getValues();

    const it = controller.start({
      credentials: {
        accessKeyId,
        secretAccessKey,
        sessionToken,
      },
      region,
      languageCode,
    });

    setStarted(true);
    for await (const transcripts of it) {
      if (transcripts.length) {
        setTranscript(transcripts.join("\n"));
      }
    }
    setStarted(false);
  }, [getValues]);

  const handleStop = React.useCallback(async () => {
    await controller.stop();
    setStarted(false);
  }, []);

  console.log();

  return (
    <div>
      <Head>
        <title>AWS Transcribe with aws-sdk-js-v3 and NextJS</title>
      </Head>

      <main>
        <h1>AWS Transcribe Test</h1>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: "720px",
            alignItems: "space-between",
          }}
        >
          <form>
            <div>
              <label>Access ID: </label>
              <input
                ref={register({ required: true })}
                name="accessKeyId"
                placeholder="ACCESS ID"
              />
            </div>
            <div>
              <label>Secret Key: </label>
              <input
                ref={register({ required: true })}
                name="secretAccessKey"
                placeholder="SECRET KEY"
              />
            </div>
            <div>
              <label>Session Secret (optional): </label>
              <input
                ref={register}
                name="sessionToken"
                placeholder="SESSION TOKEN"
              />
            </div>
            <div>
              <label>Language: </label>
              <select
                ref={register({ required: true })}
                name="languageCode"
                defaultValue={"en-US"}
              >
                <option value="" disabled>
                  --
                </option>
                <option value="en-US">US English</option>
              </select>
            </div>
            <div>
              <label>Region</label>
              <input ref={register} name="region" placeholder="REGION" />
            </div>
          </form>
          <textarea
            readOnly
            rows={5}
            value={transcript}
            placeholder={"Click on start and speak into your mic"}
          ></textarea>
          <div>
            <button onClick={handleStart} disabled={started}>
              Start
            </button>
            <button onClick={handleStop} disabled={!started}>
              Stop
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

const pcmEncodeChunk = (chunk) => {
  const input = MicrophoneStream.toRaw(chunk);
  var offset = 0;
  var buffer = new ArrayBuffer(input.length * 2);
  var view = new DataView(buffer);
  for (var i = 0; i < input.length; i++, offset += 2) {
    var s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};
