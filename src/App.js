import React, { useState, useEffect } from 'react';
import { Select, message, InputNumber, Button, Form, Input, Radio, Card, Space } from 'antd';
import { rtc, resolutions, modes, codecs, defaultState } from './utils/definitions'
import transCbToPromise from './utils/transCbToPromise'
import './App.css'

const { Option } = Select;
const { AgoraRTC }  = window
let formData = {}

function App() {
  const [form] = Form.useForm();
  const [isJoined, setIsJoined] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [isMuteAudio, setIsMuteAudio] = useState(false);
  const [isMuteVideo, setIsMuteVideo] = useState(false);
  const [devices, setDevices] = useState({videos: [], audios: []});
  const [remoteStreamsArr, setRemoteStreams] = useState([]);

  // 校验表单必填项，并获取表单数据
  const formValidate = async () => {
    try {
      await form.validateFields()
      formData = form.getFieldsValue()
    } catch (error) {
      console.log(error)
    }
  }

  // 获取本机音视频设备
  const getDevice = async () => {
    const videos = []
    const audios = []
    try {
      const res = await transCbToPromise(AgoraRTC.getDevices)
      if (res && res.length) {
        res.forEach(item => {
          if ('videoinput' === item.kind) {
            let name = item.label
            const value = item.deviceId
            if (!name) {
              name = "camera-" + videos.length
            }
            videos.push({
              name: name,
              value: value,
              kind: item.kind
            })
          }
          if ('audioinput' === item.kind) {
            let name = item.label
            const value = item.deviceId
            if (!name) {
              name = 'microphone-' + audios.length
            }
            audios.push({
              name: name,
              value: value,
              kind: item.kind
            })
          }
        })
      }
      setDevices({videos: videos, audios: audios})
    } catch (error) {

    }
  }

  // agora事件监听
  const handleEvent = () => {
    // Occurs when an error message is reported and requires error handling.
    rtc.client.on("error", (err) => {
      console.log(err)
    })
    // Occurs when the peer user leaves the channel; for example, the peer user calls Client.leave.
    rtc.client.on("peer-leave", function (evt) {
      const id = evt.uid;
      const streams = rtc.remoteStreams.filter(e => id !== e.getId())
      const peerStream = rtc.remoteStreams.find(e => id === e.getId())
      if (peerStream && peerStream.isPlaying()) {
        peerStream.stop()
      }
      rtc.remoteStreams = streams
      const tempArr = [...remoteStreamsArr]
      setRemoteStreams(tempArr.filter(item => item !== id))

      message.info("peer leave")
    })
    // Occurs when the local stream is published.
    rtc.client.on("stream-published", function (evt) {
      message.success("stream published success")
      console.log("stream-published")
    })
    // Occurs when the remote stream is added.
    rtc.client.on("stream-added", function (evt) {
      const remoteStream = evt.stream
      const id = remoteStream.getId()
      message.info("stream-added uid: " + id)
      if (id !== rtc.params.uid) {
        rtc.client.subscribe(remoteStream, function (err) {
          console.log("stream subscribe failed", err)
        })
      }
      console.log("stream-added remote-uid: ", id)
    })
    // Occurs when a user subscribes to a remote stream.
    rtc.client.on("stream-subscribed", function (evt) {
      const remoteStream = evt.stream
      const id = remoteStream.getId()
      rtc.remoteStreams.push(remoteStream)
      setRemoteStreams([...remoteStreamsArr, id])
      remoteStream.play("remote_video_" + id)
      message.info("stream-subscribed remote-uid: " + id)
    })
    // Occurs when the remote stream is removed; for example, a peer user calls Client.unpublish.
    rtc.client.on("stream-removed", function (evt) {
      const remoteStream = evt.stream
      const id = remoteStream.getId()
      message.info("stream-removed uid: " + id)
      if (remoteStream.isPlaying()) {
        remoteStream.stop()
      }
      rtc.remoteStreams = rtc.remoteStreams.filter(function (stream) {
        return stream.getId() !== id
      })
      const tempArr = [...remoteStreamsArr]
      setRemoteStreams(tempArr.filter(item => item !== id))
      // removeView(id)
      console.log("stream-removed remote-uid: ", id)
    })
    rtc.client.on("onTokenPrivilegeWillExpire", function(){
      // After requesting a new token
      // rtc.client.renewToken(token);
      message.info("onTokenPrivilegeWillExpire")
      // console.log("onTokenPrivilegeWillExpire")
    })
    rtc.client.on("onTokenPrivilegeDidExpire", function(){
        // After requesting a new token
        // client.renewToken(token);
        message.info("onTokenPrivilegeDidExpire")
        // console.log("onTokenPrivilegeDidExpire")
      })
  }

  // 加入频道
  const join = async () => {
    await formValidate()
    if (!formData.appID || !formData.channel) {
      return
    }

    // 创建本地客户端
    rtc.client = AgoraRTC.createClient({mode: formData.mode, codec: formData.codec})
    rtc.params = formData

    // 监听事件
    handleEvent()
    try {
      // 初始化
      await transCbToPromise(rtc.client.init, [formData.appID])

      try {
        // 加入
        const uid = await transCbToPromise(rtc.client.join, [formData.token ? formData.token : null, formData.channel, formData.uid ? +formData.uid : null])
        message.info("join channel: " + formData.channel + " success, uid: " + uid)
        rtc.joined = true
        setIsJoined(true)

        rtc.params.uid = uid
        // 创建本地音视频流
        rtc.localStream = AgoraRTC.createStream({
          streamID: rtc.params.uid,
          audio: true,
          video: true,
          screen: false,
          microphoneId: formData.microphoneId,
          cameraId: formData.cameraId
        })

        try {
          // 初始化本地音视频流
          await transCbToPromise(rtc.localStream.init)
          // 播放本地音视频
          rtc.localStream.play("local_stream")

          // 广播本地音视频流
          publish()
        } catch (error) {
          message.error("stream init failed, please open console see more detail")
          console.error("init local stream failed ", error)
        }
      } catch (error) {
        message.error("client join failed, please open console see more detail")
        console.error("client join failed", error)
      }
    } catch (error) {
      message.error("client init failed, please open console see more detail")
      console.error(error)
    }
  }

  const leave = () => {
    rtc.client.leave(function () {
      // 停止并关闭本地音视频流
      if(rtc.localStream.isPlaying()) {
        rtc.localStream.stop()
      }
      rtc.localStream.close()
      // 停止并关闭远程音视频流
      for (let i = 0; i < rtc.remoteStreams.length; i++) {
        const stream = rtc.remoteStreams.shift()
        if(stream.isPlaying()) {
          stream.stop()
        }
      }
      setRemoteStreams([])
      // 数据重置
      rtc.localStream = null
      rtc.remoteStreams = []
      rtc.client = null
      rtc.published = false
      setIsPublished(false)
      rtc.joined = false
      setIsJoined(false)
      message.info("leave success")
    }, function (err) {
      message.error("channel leave failed")
    })
  }

  // 广播本地音视频流
  const publish = () => {
    const oldState = rtc.published
    message.info("publish")
    rtc.client.publish(rtc.localStream, function (err) {
      rtc.published = oldState
      setIsPublished(oldState)
      message.error("publish failed")
    })
    rtc.published = true
    setIsPublished(true)
  }

  // 取消广播本地音视频流
  const unpublish = async () => {
    var oldState = rtc.published
    message.info("unpublish")
    rtc.client.unpublish(rtc.localStream, function (err) {
      rtc.published = oldState
      setIsPublished(oldState)
      message.error("unpublish failed")
    })
    rtc.published = false
    setIsPublished(false)
  }

  const muteAudio = () => {
    if (rtc.localStream.muteAudio()) {
      message.success('禁用音频轨道成功')
      setIsMuteAudio(true)
    }
  }

  const unmuteAudio = () => {
    if (rtc.localStream.unmuteAudio()) {
      message.success('启用音频轨道成功')
      setIsMuteAudio(false)
    }
  }

  const muteVideo = () => {
    if (rtc.localStream.muteVideo()) {
      message.success('禁用视频轨道成功')
      setIsMuteVideo(true)
    }
  }

  const unmuteVideo = () => {
    if (rtc.localStream.unmuteVideo()) {
      message.success('启用视频轨道成功')
      setIsMuteVideo(false)
    }
  }
  const JoinLeaveBtn = () => {
    return (
      <Button
        type="primary"
        onClick={isJoined ? leave : join}
      >
        {isJoined ? "Leave" : "Join"}
      </Button>
    );
  };

  const PubUnpubBtn = () => {
    return (
      <Button
        type="primary"
        onClick={isPublished ? unpublish : publish}
        disabled={!isJoined}
      >
        {isPublished ? "Unpublish" : "Publish"}
      </Button>
    );
  };
  const MuteUnmuteAudioBtn = () => {
    return (
      <Button
        type="primary"
        onClick={isMuteAudio ? unmuteAudio : muteAudio}
        disabled={!isJoined}
      >
        {isMuteAudio ? "UnmuteAudio" : "MuteAudio"}
      </Button>
    );
  };
  const MuteUnmuteVideoBtn = () => {
    return (
      <Button
        type="primary"
        onClick={isMuteVideo ? unmuteVideo : muteVideo}
        disabled={!isJoined}
      >
        {isMuteVideo ? "UnmuteVideo" : "MuteVideo"}
      </Button>
    );
  };

  useEffect(() => {
    // 组件加载时获取本地音视频设备
    (async () => {
      await getDevice()
    })();
    // 组件销毁时关闭本地音视频流
    return () => {
      leave()
    }
  }, [])

  return (
    <div className="wrap">
      <Card style={{ width: 450 }}>
        <Form
          layout="vertical"
          name="basic"
          form={form}
          initialValues={defaultState}
        >
          <Form.Item
            name="appID"
            label="APP ID"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="channel"
            label="Channel"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="token"
            label="Token"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="uid"
            label="UID"
          >
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item
            name="cameraId"
            label="CAMERA"
          >
            <Select>
              {devices.videos.map((resolution) => (
                <Option key={resolution.value} value={resolution.value}>{resolution.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="microphoneId"
            label="MICROPHONE"
          >
            <Select>
              {devices.audios.map((resolution) => (
                <Option key={resolution.value} value={resolution.value}>{resolution.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="resolution"
            label="CAMERA RESOLUTION"
          >
            <Select>
              {resolutions.map((resolution) => (
                <Option key={resolution.value} value={resolution.value}>{resolution.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="mode"
            label="MODE"
          >
            <Radio.Group>
              {modes.map((mode) => (
                <Radio key={mode.value} value={mode.value}>{mode.name}</Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="codec"
            label="CODEC"
          >
            <Radio.Group>
              {codecs.map((codec) => (
                <Radio key={codec.value} value={codec.value}>{codec.name}</Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Form.Item>
            <Space>
              {JoinLeaveBtn()}
              {PubUnpubBtn()}
              {MuteUnmuteAudioBtn()}
              {MuteUnmuteVideoBtn()}
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <div className="video-grid" id="video">
        <div className="video-view">
          <div id="local_stream" className="video-placeholder"></div>
          { remoteStreamsArr.map((item, index) => {
            return (
              <div key={index} id={'remote_video_' + item} className="video-placeholder"></div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default App
