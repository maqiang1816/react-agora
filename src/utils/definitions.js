export const rtc = {
  client: null,
  joined: false,
  published: false,
  localStream: null,
  remoteStreams: [],
  params: {}
}

export const resolutions = [{
  name: "default",
  value: "default",
},
{
  name: "480p",
  value: "480p",
},
{
  name: "720p",
  value: "720p",
},
{
  name: "1080p",
  value: "1080p"
}];

export const modes = [{
  name: "live",
  value: "live",
}, {
  name: "rtc",
  value: "rtc",
}];

export const codecs = [{
  name: "h264",
  value: "h264"
}, {
  name: "vp8",
  value: "vp8"
}]

export const defaultState = {
  appId: "",
  channel: "",
  uid: "",
  token: undefined,
  cameraId: "",
  microphoneId: "",
  resolution: 'default',
  mode: "rtc",
  codec: "h264"
};
