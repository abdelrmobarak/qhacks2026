import { useState, useCallback, useRef, useEffect } from 'react'
import { Microphone, MicrophoneSlash, SpeakerHigh, CircleNotch } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'motion/react'

import { Button } from '@/components/ui/button'
import { api, type VoiceChatResponse } from '../lib/api'

const OGG_OPUS_MIME = 'audio/ogg;codecs=opus'
const SUPPORTS_OGG_RECORDING = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(OGG_OPUS_MIME)
const TARGET_SAMPLE_RATE = 24000

const resampleChannel = (channelData: Float32Array, inputRate: number, outputRate: number): Float32Array => {
  if (inputRate === outputRate) return channelData
  const ratio = inputRate / outputRate
  const outputLength = Math.round(channelData.length / ratio)
  const output = new Float32Array(outputLength)
  for (let outputIndex = 0; outputIndex < outputLength; outputIndex++) {
    const inputIndex = outputIndex * ratio
    const low = Math.floor(inputIndex)
    const high = Math.min(low + 1, channelData.length - 1)
    const fraction = inputIndex - low
    output[outputIndex] = channelData[low] * (1 - fraction) + channelData[high] * fraction
  }
  return output
}

const encodeWav = (audioBuffer: AudioBuffer): Blob => {
  const rawChannel = audioBuffer.getChannelData(0)
  const samples = resampleChannel(rawChannel, audioBuffer.sampleRate, TARGET_SAMPLE_RATE)
  const bytesPerSample = 2
  const dataLength = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataLength)
  const view = new DataView(buffer)

  const writeString = (byteOffset: number, value: string): void => {
    for (let charIndex = 0; charIndex < value.length; charIndex++) {
      view.setUint8(byteOffset + charIndex, value.charCodeAt(charIndex))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, TARGET_SAMPLE_RATE, true)
  view.setUint32(28, TARGET_SAMPLE_RATE * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataLength, true)

  let writeOffset = 44
  for (let sampleIndex = 0; sampleIndex < samples.length; sampleIndex++) {
    const clampedSample = Math.max(-1, Math.min(1, samples[sampleIndex]))
    view.setInt16(writeOffset, clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff, true)
    writeOffset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

const PROCESSING_STEPS = [
  'Encoding...',
  'Transcribing...',
  'Thinking...',
  'Pondering...',
]

const STEP_REVEAL_MILLISECONDS = 2000

type VoiceState = 'idle' | 'recording' | 'processing' | 'playing'

interface VoiceEntry {
  id: string
  transcript: string
  response: string
}

const Voice = () => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [history, setHistory] = useState<VoiceEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const playbackContextRef = useRef<AudioContext | null>(null)

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      const recorderOptions: MediaRecorderOptions = { audioBitsPerSecond: 128000 }
      if (MediaRecorder.isTypeSupported(OGG_OPUS_MIME)) {
        recorderOptions.mimeType = OGG_OPUS_MIME
      }
      const mediaRecorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType })
        stream.getTracks().forEach((track) => track.stop())

        setVoiceState('processing')

        try {
          let audioBlob: Blob
          if (SUPPORTS_OGG_RECORDING) {
            audioBlob = rawBlob
          } else {
            const audioContext = new AudioContext()
            const arrayBuffer = await rawBlob.arrayBuffer()
            const decodedAudio = await audioContext.decodeAudioData(arrayBuffer)
            audioBlob = encodeWav(decodedAudio)
            await audioContext.close()
          }

          const response: VoiceChatResponse = await api.sendVoiceChatCommand(audioBlob)

          const entryId = `voice-${Date.now()}`
          setHistory((previous) => [
            {
              id: entryId,
              transcript: response.transcript || '',
              response: response.response_text,
            },
            ...previous,
          ])

          if (response.audio_base64) {
            setVoiceState('playing')
            try {
              const audioBytes = Uint8Array.from(atob(response.audio_base64), (character) =>
                character.charCodeAt(0)
              )
              const playbackContext = new AudioContext()
              playbackContextRef.current = playbackContext
              const audioBuffer = await playbackContext.decodeAudioData(audioBytes.buffer)
              const source = playbackContext.createBufferSource()
              source.buffer = audioBuffer
              source.connect(playbackContext.destination)

              const finishPlayback = () => {
                clearTimeout(fallbackTimer)
                playbackContext.close()
                playbackContextRef.current = null
                setVoiceState('idle')
              }

              source.onended = finishPlayback
              source.start()

              // HACK: AudioBufferSourceNode.onended doesn't fire reliably in Electron
              const fallbackTimer = setTimeout(finishPlayback, audioBuffer.duration * 1000 + 500)
            } catch {
              setVoiceState('idle')
            }
          } else {
            setVoiceState('idle')
          }
        } catch (voiceError) {
          setError(voiceError instanceof Error ? voiceError.message : 'Voice command failed.')
          setVoiceState('idle')
        }
      }

      mediaRecorder.start()
      setVoiceState('recording')
    } catch {
      setError('Microphone access denied.')
      setVoiceState('idle')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && voiceState === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [voiceState])

  const handleMicClick = useCallback(() => {
    if (voiceState === 'recording') {
      stopRecording()
    } else if (voiceState === 'idle') {
      startRecording()
    }
  }, [voiceState, startRecording, stopRecording])

  const isRecording = voiceState === 'recording'
  const isProcessing = voiceState === 'processing'
  const isPlaying = voiceState === 'playing'
  const isBusy = isProcessing || isPlaying

  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    if (!isProcessing) {
      setStepIndex(0)
      return
    }
    const intervalId = setInterval(() => {
      setStepIndex((previous) => (previous + 1) % PROCESSING_STEPS.length)
    }, STEP_REVEAL_MILLISECONDS)
    return () => clearInterval(intervalId)
  }, [isProcessing])

  return (
    <div className="flex flex-col items-center h-full max-w-screen-sm mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <AnimatePresence mode="wait">
          {isRecording && (
            <motion.div
              key="recording"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex gap-1 items-end h-8">
                {Array.from({ length: 5 }).map((_, barIndex) => (
                  <motion.div
                    key={barIndex}
                    className="w-1 rounded-full bg-primary"
                    animate={{ height: [8, 24, 8] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: barIndex * 0.15,
                      ease: 'easeInOut',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">Listening...</span>
            </motion.div>
          )}

          {isProcessing && (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              <CircleNotch className="size-8 text-primary animate-spin" />
              <span className="text-xs text-muted-foreground">
                {PROCESSING_STEPS[stepIndex]}
              </span>
            </motion.div>
          )}

          {isPlaying && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              <SpeakerHigh className="size-8 text-primary" />
              <span className="text-xs text-muted-foreground">Speaking...</span>
            </motion.div>
          )}

          {voiceState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center gap-3"
            >
              <span className="text-sm text-muted-foreground">
                {history.length > 0 ? 'Tap to speak again' : 'Tap the mic to start'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <span className="text-xs text-destructive">{error}</span>
        )}

        <Button
          variant={isRecording ? 'destructive' : 'default'}
          size="lg"
          className="size-16 rounded-full"
          onClick={handleMicClick}
          disabled={isBusy}
        >
          {isRecording ? (
            <MicrophoneSlash className="size-6" />
          ) : isBusy ? (
            <CircleNotch className="size-6 animate-spin" />
          ) : (
            <Microphone className="size-6" />
          )}
        </Button>
      </div>

      {history.length > 0 && (
        <div className="w-full flex flex-col gap-2 pb-4 max-h-64 overflow-y-auto">
          {history.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-1 p-3 border border-border rounded-lg">
              {entry.transcript && (
                <span className="text-xs font-medium">{entry.transcript}</span>
              )}
              <span className="text-xs text-muted-foreground">{entry.response}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Voice
