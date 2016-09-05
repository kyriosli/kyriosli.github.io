---
layout: post
title: "正式推荐AgentK"
date: "2016-07-20 12:00:00"
timezone: Asia/Hong_Kong
permalink: /agentk/
---

最近在内部推广AgentK中屡屡被吐槽AgentK的安装难问题,而且很多时候连我自己尝试去安装的时候都搞得头大不已。痛定思痛,决定一定要把这个问题解决!
虽然最后用了一个不是很优雅的方式解决,但总算能顺利安装下来了。在折腾的过程中顺便把架构改了改,现在正式开始推荐!

### 什么是AgentK

[AgentK](https://github.com/kyriosli/agentk) 是一个集开发流程和运维于一体的Node.JS开发框架，旨在解决快速搭建Node.JS项目过程中常见的难题。
首先,它不仅仅是一个Node.JS程序搭建框架,更是一套完整的解决方案,可以认为是以下四大部分组成的:

  - 运行环境
  - 编程范式、异步解决方案
  - 测试工具
  - 模块、组件

它的主要优势在于通过协程方案解决了异步函数调用的回调和异常处理问题,并能够完美地和基于Promise的其它异步解决方案相结合。

### 如何安装

你可以通过`npm`安装AgentK:

    (sudo) npm install agentk -g

AgentK 支持0.12.x以上的node，但对4.x支持较差(不兼容一些ES6特性). 如果您使用较旧的node，如0.12.x，请尝试安装专门为低版本node准备的包:

    (sudo) npm install agentk-old-node -g

安装成功后可以通过`ak`命令进行应用启动工作及获得帮助。

想要了解更多,可以参考[wiki](https://github.com/kyriosli/agentk/wiki)

### Web项目架构

推荐的项目架构如下:

  - webapp: 这个是代码目录,下面的文件将被发布到生产环境
    - package.json: npm配置文件,用来设置包依赖等
    - manifest.json: 项目配置文件
    - src: 源码目录
      - index.js: 项目启动入口,初始化各种组件并启动web服务
      - module: 模块目录,存放各种模块及组件
    - work: 资源目录,也是Node.JS启动后的工作目录,所有的文件读写相对路径将从这里开始
      - view: 模版文件目录,用于模版引擎渲染文件
      - static: 静态文件目录,用于静态文件输出
    - node_modules: 项目依赖的包
  - logs: 存放日志文件

当然,AgentK本身对项目架构几乎没有任何硬性要求,只是在实践过程中摸索出了这套较为成熟的方案。以下任何讨论都将基于以上方案,在实际使用过程中可以根据
需求自行调整。

### manifest.json

manifest.json是AgentK最重要的文件,规定了项目的一些属性,如启动入口文件的路径,工作目录等,也可以用来指定一些配置。一个常规的manifest如下:

```json
{
  "main": "src/index.js",  // 启动入口(相对于项目目录),默认为'index.js'
  "directory": "work",     // 工作目录(相对于项目目录),默认为项目目录
  "workers": 4             // 子进程个数,默认为1
  "stdout": "../../logs/out.log",  // 标准输出路径(相对于工作目录),默认为拷贝守护进程的标准输出
  "stderr": "../../logs/err.log",  // 标准错误输出路径(相对于工作目录),默认为拷贝守护进程的标准错误输出
  "config": {              // 可选的配置路径,通过 manifest.config.xxx... 访问
    "http_port": 8080,     // 初始化http server时指定的端口
    "view_engine": "ejs",  // 初始化模版引擎时指定的默认模版引擎名称
    "views": "view"        // 初始化模版引擎时指定的模版文件路径(相对于工作目录)
  },
  "action": {              // 可选的触发器配置
    "reload": "src/index"  // reload触发器的声明模块
  }
}
```

### 运行项目

有若干种运行项目的方式:

```js
require('agentk').run(programDir);    // 以模块方式安装agentk后,通过指定项目目录执行项目
require('agentk').run(manifest_file); // 以模块方式安装agentk后,通过指定manifest文件执行项目
require('agentk').load(entry);        // 以模块方式安装agentk后,加载并运行入口js文件
```

```sh
ak run programDir    # 全局安装agentk后,通过ak命令指定项目目录启动,适合开发过程
ak run manifest_file # 全局安装agentk后,通过ak命令指定manifest文件启动
ak start programDir  # 以守护进程启动项目,适合生产环境
```

-- to be continued