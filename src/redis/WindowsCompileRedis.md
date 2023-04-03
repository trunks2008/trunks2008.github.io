---
title: 手摸手教你在Windows环境下运行Redis6.x
icon: page
order: 11
author: Hydra
date: 2022-04-02
tag:
  - Redis
  - 编译
star: true
---



<!-- more -->

哈喽大家好啊，我是没事就愿意瞎捣鼓的Hydra。

不知道有没有小伙伴像我一样，平常开发中用的是windows操作系统，有时候想装点什么软件，一看只支持linux系统，无奈要么启动虚拟机、要么装在云服务器上。

这不前几天又是这样，刚想用一下Redis 6.x版本来尝试一下新特性，打开官网一看，好家伙我直呼内行，果然不支持windows系统：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e22df09d86524172af04acd1c4b71394~tplv-k3u1fbpfcp-zoom-1.image)

不过虽然redis的官网上不提供windows版本下载，但是这也难不倒我这个面向百度编程的小能手，一番查找后让我找到了微软在github上维护的几个可以在windows上运行的redis版本：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1720c91681334fb09699ee50b0d210d3~tplv-k3u1fbpfcp-zoom-1.image)

项目的git地址是 `https://github.com/MicrosoftArchive/redis/releases`，我翻了一下，微软维护了`2.x`和`3.x`的多个windows版本redis，不过比较遗憾，在维护到`3.0.504`正式版本后就放弃了更新。

不过问题不大，眼看微软撂挑子不干了，波兰的热心市民 Tomasz Poradowski 先生这时候站出来，继续开始提供可以在windows上运行的`4.x`和`5.x`版本的redis，并且从2017年到2022年一干就是5年。

![3](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef057296cd67406aa226593a59be7a7a~tplv-k3u1fbpfcp-zoom-1.image)

项目git地址是`https://github.com/tporadowski/redis/releases`，没错，其实我本地环境运行的`redis-5.0.9`就是以前从这里下载的，而且绿色版使用起来真的是干净又卫生，所以我强烈建议大家给这位老哥来一个Star支持一下。

不过绕了这么一大圈，我的问题还是没有解决啊，既然没有现成的可以在windows上运行的`redis6.x`版本，那我们干脆就来自己编译一个吧。

## 初识Cygwin

首先介绍一下我们今天要用到的工具**Cygwin**，先简单看一下它的官网 `https://cygwin.com/`，上面很清晰的解释了几个容易引起大家混淆的问题：

![15](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4ec254bf5a8947a89d839eb1aa5d1ebb~tplv-k3u1fbpfcp-zoom-1.image)

先解释了cygwin是什么：

- cygwin是`GNU`和开源工具的大型集合，它提供了类似于在windows上运行linux发行版的模拟环境功能
- cygwin是一个动态链接库`cygwin1.dll`，它提供了大量`POSIX`的API功能

再纠正了大家的常见误区：

- cygwin并不能让原生的linux应用程序运行在windows上，如果想让它运行在windows上，那么你必须通过源代码重新构建你的应用
- cygwin并不能神奇地让原生的windows应用程序感知到unix的功能，例如信号、伪终端等

其实可以用一句话来概括一下它的功能，**cygwin是一个可运行于原生windows系统上的POSIX兼容环境，可以通过重新编译将linux应用移植到windows中**。

好了，这样简单了解一下cygwin的功能对我们来说暂时就足够了，下面我们看看如何使用它来编译windows版本redis。

## Cygwin安装

下面我们先进行编译工具`Cygwin`的下载和安装，在它的官网上就可以直接下载，完成后就可以开始安装了。下面我会贴出一些需要特殊配置的步骤，如果没有特殊说明的话，那么直接痛快的点击下一步就可以了。

网络连接配置这里选择第二项，也就是直接连接，不需要任何代理方式：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/782d87ded9b14202b245448030660c9f~tplv-k3u1fbpfcp-zoom-1.image)

在选择下载源这一步，先手动输入`User URL`，添加阿里云的镜像`http://mirrors.aliyun.com/cygwin`，点击`add`后再选择我们刚才添加的这个源，然后点击下一步：

![5](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b5e25b16fda74091a55d8aead17a3b0a~tplv-k3u1fbpfcp-zoom-1.image)

接下来选择需要下载安装的组件包，我们只需要下载我们编译相关的模块即可。先通过上面的搜索框进行定位，选择安装`Devel`模块下面的`make`、`gcc-core`，`gcc-g++`，以及`Libs`模块下的`libgcc1` 、`libgccpp1`，然后点击`New`这一列的`Skip`，选择要安装的版本号，全部添加完成后点击下一步：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6d949fc87f9e4352a7cfbc0117c5ae95~tplv-k3u1fbpfcp-zoom-1.image)

接下来会自动进行下载上面选择的模块，等待全部下载结束后安装就完成了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/cd2fc8741cc14a668e56a1e95f8fed52~tplv-k3u1fbpfcp-zoom-1.image)

安装完成后，我们运行`Cygwin64 Terminal`，通过命令检测可以看到`Status`为`OK`，表示cygwin运行正常：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/68be9bb65f014aec9fe427ab40b5d208~tplv-k3u1fbpfcp-zoom-1.image)

## 编译redis源码

准备好编译工具后，我们接下来先下载`redis6.x`版本的源码，`6.0.16`的下载地址为：

> https://download.redis.io/releases/redis-6.0.16.tar.gz

cygwin安装完成后，会在它的安装路径的`home`目录下，创建一个以你登录系统的用户名来命名的目录，我们把下载完成后的压缩包放到这个`cygwin64\home\${user}`目录下，在cygwin命令行中先执行解压命令：

```shell
tar -xvf redis-6.0.16.tar.gz
```

使用下面的命令先切换到解压后的根目录，然后执行编译和安装：

```shell
cd redis-6.0.16 
make && make install 
```

点击回车，然后就开始漫长的等待吧，不得不说编译和安装的过程真的很慢，我这大概花了20分钟才全部完成。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e4aaa29f1454466e9b5f4571fd86e654~tplv-k3u1fbpfcp-zoom-1.image)

不出意外的最后果然出现了意外，报了两个`Error`，不过貌似没有什么太大影响，切换到`src`目录下，就已经可以看到编译完成后已经生成了6个`exe`可执行文件了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/a835f1895e53413d83cadd8f049e6cba~tplv-k3u1fbpfcp-zoom-1.image)

但是如果这个时候双击`redis-server.exe`尝试进行启动的话，那么就会报错提示缺少`dll`动态链接库：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b4e3daf548d64b948a1e652f80251aa6~tplv-k3u1fbpfcp-zoom-1.image)

我们可以在cygwin的`bin`目录下找到这个文件，为了方便，把可执行文件、动态链接库文件、redis配置文件拷贝到一个单独的目录下再次尝试启动：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/08d6405849744febbf5e4050ca7f1baa~tplv-k3u1fbpfcp-zoom-1.image)

这次能够正常启动成功，我们再使用客户端连接工具连接并进行测试，终于，6.0.16版本的redis可以在windows环境下正常运行了。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2aef4a491c744d0db601ca5750e565d7~tplv-k3u1fbpfcp-zoom-1.image)

## 最后

忙活一大顿总算成功了，我们也终于可以在windows上体验`redis6.x`版本了，不过这里还是给小伙伴们提个醒，这样编译的redis我们平常自己在学习中体验一下就可以了，尽量不要用在生产上。

因为cygwin编译后的程序，相当于在windows系统上模拟实现了`POSIX`兼容层，应用程序在底层多了一层函数调用，因此效率比运行在linux系统的原生应用低了很多。因此，这样在windows上运行的redis，无疑会损失掉它引以为傲的高性能这一优势。

秉持着好东西就要分享的原则，我也已经把编译好的windows版`redis6.0.16`上传到了网盘，有需要的小伙伴们可以通过下面的方式获取：

> 链接：https://pan.baidu.com/s/1jlPVR0Odh_xjqBBb7gorWg 
>
> 提取码：8386




