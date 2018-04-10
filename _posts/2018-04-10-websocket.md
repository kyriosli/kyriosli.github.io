---
layout: post
title: "WebSocket 协议"
date: "2018-04-10 00:00:00"
timezone: Asia/Hong_Kong
---

关于 [WebSocket](https://developer.mozilla.org/zh-CN/docs/Web/API/WebSocket) 的定义无需多说，这里我们讲一下 WebSocket 的协议细节。

## 接受请求

WebSocket 是一个应用层的协议，它通过 HTTP 协议进行握手和协商，然后通过底层的 TCP / TLS 等进行传输。当客户端发起请求时，服务端收到一个特殊的 HTTP 请求，代表 WebSocket 连接请求：

```
GET /ws HTTP/1.1
Host: xxxxx
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: xxxx
Sec-WebSocket-Extensions: ....
```

服务端收到连接请求后，判断请求是否合法。如果接受连接，则返回响应：

```
HTTP/1.1 101 Switch Protocol
Server: xxxx
Connection: Upgrade
Upgrade: websocket
Sec-WebSocket-Accept: xxxxxx
Sec-WebSocket-Extensions: ...
```

我们以 Node.JS 为示例来看如何处理连接请求：

```js
// websocket 连接验证的盐
const unique_key = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
// message 类型
const OPCODE_TEXT = 1,
      OPCODE_BINARY = 2,
      OPCODE_CLOSE = 8;
// close 类型
const CLOSE_NORMAL = 1000,
      CLOSE_GOING_AWAY = 1001,
      CLOSE_PROTOCOL_ERROR = 1002,
      CLOSE_UNSUPPORTED = 1003,
      CLOSE_ABNORMAL = 1006,
      CLOSE_INTERNAL_ERROR = 1011;
// flags
const FLAG_FIN = 8, FLAG_RSV1 = 4;
// 创建 HTTP server。HTTP server 可以处理普通的 http 请求，只需为其设置 upgrade 事件处理函数，即可处理 websocket 请求。
let server = require('http').createServer(...);
// 处理普通的 http 请求
server.on('request', function (req, res) {
    // ...
});

// 处理 upgrade 请求
server.on('upgrade', function (req, socket) {
    let upgrade = req.headers.upgrade;
    if(upgrade && upgrade.toLowerCase() === 'websocket') { // 是 websocket 请求！
        on_websocket(req, socket);
    }
});

function on_websocket(req, socket) {
    // 可以根据 req.url 等判断是否接受请求
    if(!is_valid_request(req)) {
        socket.end("HTTP/1.1 403 Forbidden\r\n"
                 + "Connection: close\r\n"
                 + "Content-Length: 3\r\n"
                 + "\r\n"
                 + "bye");
        return;
    }
    // 接受请求！
    let key = req.headers['sec-websocket-key'];
    let accept = sha1(key + unique_key).toString('base64');
    // 以固定 key 作为盐进行 sha1
    socket.write("HTTP/1.1 101 Switch Protocol\r\n"
               + "Connection: Upgrade\r\n"
               + "Upgrade: websocket\r\n"
               + `Sec-WebSocket-Accept: ${accept}\r\n`
               + "\r\n");
    // 读写 socket...
}
```

以 Node.JS 发起 websocket 请求方式如下：

```js
// 连接 ws://127.0.0.1:8888/foo
let key = 'xxxxxx'; // 随机生成字符串
let options = {
    method: 'GET', // this is default
    host: '127.0.0.1',
    port: 8888,
    path: '/foo',
    headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
    },
};

let req = require('http').request(options);

req.on('upgrade', function (res, socket) {
    // 收到 upgrade 响应
    let resp_accept = res.headers['sec-websocket-accept'];
    let accept = sha1(key + unique_key).toString('base64');
    if(resp_accept !== accept) {
        on_reject({ message: 'bad response' });
        return;
    }
    // 读写 socket...
});
req.on('response', function (res) {
    // 收到普通响应
    on_reject({ message: 'bad response' })
});
req.end(); // GET 没有请求 body，这里不发送任何内容
```

## sending / receiving messages

WebSocket 的 client / server 端的读写过程基本相同，除了一个差别：client 需要对每个消息的 payload 进行异或掩码。

不同平台的 socket 读取过程不尽相同。为了方便我们以流的模式来演示读取过程。由于 Node.JS 的 socket 读取过程是异步的，实际读取时可以通过 generator / fiber / async 等方法转换为流式读取，这里不再赘述。

```js
function read_messages(socket, is_server) {
    for(;;) {
        let header = read(socket, 2); // 读取 2 字节的头部
        // 头部包含 以下信息：
        // * 4 个 flag
        // * 4 比特的 opcode, 标识 message 类型
        // * masked 位，标识消息是否进行了掩码
        // * 7 比特的 payload_len，标识 payload 长度
        const flag = header[0] >> 4, opcode = header[0] & 0xf, masked = header[1] & 0x80;
        let payload_len = header[1] & 0x7f;
        if(!(flag & FLAG_FIN)) { // STOP
            on_close({code: CLOSE_GOING_AWAY});
            socket.destroy();
            return;
        }
        if(is_server && !masked) {
            // 客户端发来了未掩码的消息！
            send_close(CLOSE_PROTOCOL_ERROR);
            throw ...
        }
        if(!is_server && masked) {
            // 服务端发来了掩码过的消息！
            send_close(CLOSE_PROTOCOL_ERROR);
            throw ...
        }
        // 对 payload_len 进行处理
        if(payload_len === 126) {
            // 实际 payload_len 是 2 字节的 big-endian uint16
            let buf = read(socket, 2);
            payload_len = buf.readUInt16BE(0, true);
            // payload_len = buf[0] << 8 | buf[1];
        } else if(payload_len === 127) {
            // 实际 payload_len 是 8 字节的 big-endian uint64
            let buf = read(socket, 8);
            payload_len = buf.readUInt32BE(0, true) * 0x100000000 + buf.readUInt32BE(4, true);
        }
        // 处理 mask
        let mask = null;
        if(masked) {
            // 读取 4 字节的 mask
            mask = read(socket, 4);
        }
        // 读取 payload
        const payload = read(socket, payload_len);
        if(masked) { // 反掩码
            for(let i = 0; i < payload_len; i++) {
                payload[i] ^= mask[i & 3];
            }
        }
        // TODO: 对压缩的内容进行解压缩
        if(opcode === OPCODE_TEXT) {
            on_message({
                type: 'text',
                data: payload.toString(),
            });
        } else if(opcode === OPCODE_BINARY) {
            on_message({
                type: 'binary',
                data: payload
            });
        } else if(opcode === OPCODE_CLOSE) {
            socket.destroy();
            if(payload.length >= 2) {
                on_close({
                    code: payload.readUInt16BE(0, true),
                    reason: payload.toString('utf8', 2),
                });
            } else {
                on_close({
                    code: CLOSE_NORMAL
                });
            }
        }
    }
}
```

发送消息的过程和其相对应。如果要发送文本，需要先将其编码为 buffer，然后指定 opcode 为 `OPCODE_TEXT` 即可。
```js
function send(opcode, flags, payload) {
    // 写入头部
    let head = Buffer.alloc(2);
    head[0] = flags << 4 | opcode;
    const masked = is_server ? 0 : 0x80;
    let payload_len = payload.length;
    if(payload_len > 65535) {
        head[1] = masked | 127;
    } else if(payload_len > 125) {
        head[1] = masked | 126;
    } else {
        head[1] = masked | payload_len;
    }
    write(head);

    if(payload_len > 65535) {
        let buf = Buffer.alloc(8);
        buf.writeUInt32BE(payload_len / 0x100000000, 0 ,true);
        buf.writeUInt32BE(payload_len, 4 ,true);
        write(buf);
    } else if(payload_len > 125) {
        let buf = Buffer.alloc(2);
        buf.writeUInt16BE(payload_len, 0 ,true);
        write(buf);
    }
    if(masked) {
        let mask = Buffer.alloc(4);
        // 随机填充 mask
        mask.writeUInt32BE(Math.random() * 0x100000000, 0, true);
        write(mask);
        for(let i = 0; i < paylaod_len; i++) {
            payload[i] ^= mask[i & 3];
        }
    }
    write(payload);
}
```

如: 发送一段文本:

```js
function send_text(text) {
    let payload = Buffer.from(text);
    send(OPCODE_TEXT, FLAG_FIN, payload);
}
```

要关闭连接，可以给对方发送一个 close 消息

```js
function send_close(code, reason) {
    if(!reason) reason = '';
    let payload = Buffer.alloc(2 + Buffer.byteLength(reason));
    payload.writeUInt16BE(code, 0, true);
    payload.write(reason, 2);
    send(OPCODE_CLOSE, 0, payload);
}
```

## 压缩

为了更高效地发送较长文本，可以对消息进行 deflate 压缩。deflate 压缩发生在 payload 长度计算之前，因此消息中的 payload 长度是压缩后的长度。deflate 压缩的协商过程如下：

首先，客户端发起请求时，在请求头中指定支持 deflate: 

```
GET ...
Sec-WebSocket-Extension: permessage-deflate
```

如果服务端支持 deflate，将在响应头中也指定 `Sec-WebSocket-Extension: permessage-deflate`。

> 某些场景下，服务端的内存是有限的。客户端可以在请求头中附加选项：
> ```
> Sec-WebSocket-Extension: permessage-deflate; client_max_window_bits
> ```
> `client_max_window_bits` 选项表示客户端支持服务端指定其压缩的 deflate 滑动窗口大小，一般取值 8-15。
>
> 此时，服务端在响应时可以为客户端指定 deflate 滑动窗口大小：
> ```
> Sec-WebSocket-Extension: permessage-deflate; client_max_window_bits=15
> ```
> 这里指定了滑动窗口大小为 15 位，即最大 32767 字节。服务端在解压缩时只需不超过 32767 字节的滑动窗口即可完成解压缩。

在发送消息时，需要对消息进行压缩。需要注意到压缩操作的上下文是整个连接的，因此必须在整个连接开始即初始化压缩、解压上下文：
```js
let inflater = zlib.createInflateRaw();
let deflater = zlib.createDeflateRaw({ flush: zlib.Z_SYNC_FLUSH });
```
但是在压缩时，每次消息内容必须独立发送，因此 websocket 会在每个消息结尾进行一次强制 flush。在接收时，也需要在每个消息结尾进行 flush。

```js
function send_deflated(opcode, flags, payload) {
    // 对 payload 进行 deflate 压缩
    payload = deflate(payload);
    send(opcode, flags | FLAG_RSV1, payload); // FLAG_RSV1 是 deflate 标识
}
```
deflate 在 Node.JS 中是一个异步操作，我们以 callback 方式表述实现如下：
```js
function deflate(payload, cb) {
    deflater.write(payload);
    deflater.flush(zlib.Z_SYNC_FLUSH, function () {
        // 读取流
        let received = [], recv_len = 0;
        let buf;
        while(buf = deflater.read()) {
            received.push(buf);
            recv_len += buf.length;
        }
        const deflated = Buffer.concat(received, recv_len);
        // deflated 末尾会有 4 字节的 flush tail: 00 00 FF FF，我们需要将其去除
        cb(null, deflated.slice(0, -4));
    });
}
```
在读取操作中，得到 payload 后需要对齐进行解压缩:
```js
let payload = ...;
if(masked) {...}
payload = inflate(payload);
```
inflate 也是一个异步操作，其过程如下：
```js
function inflate(payload, cb) {
    inflater.write(payload);
    inflater.write(FLUSH_TAIL); // 00 00 FF FF
    inflater.flush(function () {
        // 读取流
        const inflated = Buffer.concat...
        cb(null, inflated);
    });
}
```