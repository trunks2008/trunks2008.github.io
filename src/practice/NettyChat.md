---
title: 基于Netty实现群聊系统
icon: page
order: 2
author: Hydra
date: 2020-12-27
tag:
  - Netty
star: true
---



<!-- more -->

在之前的文章中，我们介绍了基于Netty实现一个RPC框架。除此之外，在工作中Netty也被广泛应用于实现即时通讯的技术方案之一，今天我们就来看一看，基于Netty如何实现一个简单的群聊系统。

服务端启动代码中，创建两个`EventLoopGroup`事件循环线程组，`bossGroup`专门负责接收客户端的连接，`workerGroup`专门负责网络的读写。之后使用`ServerBootstrap`服务端启动引导类配置整个Netty程序，串联各个组件进行启动，这里对于参数的配置不再赘述。

```java
public class GroupChatServer {
    private int port;
    public GroupChatServer(int port) {
        this.port = port;
    }
    public void run() {
        EventLoopGroup bossGroup = new NioEventLoopGroup(1);
        EventLoopGroup workerGroup = new NioEventLoopGroup();
        try {
            ServerBootstrap bootstrap = new ServerBootstrap();
            bootstrap.group(bossGroup, workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .option(ChannelOption.SO_BACKLOG, 128)
                    .childOption(ChannelOption.SO_KEEPALIVE, true)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            pipeline.addLast("decoder", new StringDecoder());
                            pipeline.addLast("encoder", new StringEncoder());
                            pipeline.addLast(new GroupChatServerHandler());
                        }
                    });
            System.out.println("NETTY SERVER IS READY");
            ChannelFuture channelFuture = bootstrap.bind(port).sync();
            channelFuture.channel().closeFuture().sync();
        }catch (Exception e){
            e.printStackTrace();
        }finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}
```

在服务端启动时核心逻辑为：

- 获取管道`pipeline`
- 向`pipeline`中加入解码器和编码器
- 加入业务处理器`handler`

具体的业务处理器在下面进行定义，继承`SimpleChannelInboundHandler`类，处理接收的消息：

```java
public class GroupChatServerHandler extends SimpleChannelInboundHandler<String> {
    private static ChannelGroup channelGroup=new DefaultChannelGroup(GlobalEventExecutor.INSTANCE);
    ...
}
```

首先定义一个`ChannelGroup` 组，管理所有`channel`。`GlobalEventExecutor.INSTANCE` 表示是全局的事件执行器，是一个单例模式。

下面看看需要重写的几个核心方法：

```java
@Override
public void handlerAdded(ChannelHandlerContext ctx) throws Exception {
    Channel channel = ctx.channel();
    channelGroup.writeAndFlush("[客户端]"+channel.remoteAddress()+"加入聊天"+sdf.format(new Date())+"\n");
    channelGroup.add(channel);
}
```

`handlerAdded` 表示连接建立，一旦连接将被第一个被执行。在该方法中，将当前`channel`加入到`channelGroup`。并将该客户加入聊天的信息推送给其他在线的客户端，这里遍历`channelGroup`中所有`channel`，并发送消息。

```java
@Override
public void handlerRemoved(ChannelHandlerContext ctx) throws Exception {
    Channel channel = ctx.channel();
    channelGroup.writeAndFlush("[客户端]"+channel.remoteAddress()+"离开了\n");
    System.out.println("channelGroup size:"+channelGroup.size());
}
```

断开连接会触发`handlerRemoved`方法。在该方法中，将下线消息推送给当前在线的客户。需要注意，执行了当前方法时就相当于已经执行了：

```java
channelGroup.remove(channel);
```

这里会自动执行`remove`方法，所以就不需要我们再额外手动调用`remove`方法了。

```java
@Override
public void channelActive(ChannelHandlerContext ctx) throws Exception {
    System.out.println(ctx.channel().remoteAddress()+" 上线了");
}

@Override
public void channelInactive(ChannelHandlerContext ctx) throws Exception {
    System.out.println(ctx.channel().remoteAddress()+" 离线了");
}
```

`channelActive`方法和`channelInactive`方法表示`channel`处于活动状态或不活动状态，这里仅打印上下线信息。

```java
@Override
protected void channelRead0(ChannelHandlerContext ctx, String msg) throws Exception {
    Channel channel = ctx.channel();
    channelGroup.forEach(ch->{
        if(channel!=ch){
            ch.writeAndFlush("[客户]"+channel.remoteAddress()+" 发送了消息:"+msg+"\n");
        }else{显示自己发送的信息
            ch.writeAndFlush("[自己]发送了消息:"+msg+"\n");
        }
    });
}
```

`channelRead0()`是读取数据方法，在该方法中，遍历`channelGroup`，根据不同情况，发送不同消息。

- 如果不是当前的`channel`，那么显示其他客户端发送了消息
- 如果是当前的`channel`，显示自己发送了信息

```java
@Override
public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
    ctx.close();
}
```

最后，在发生异常时执行`exceptionCaught`方法，关闭`ChannelHandlerContext `。

客户端详细代码如下：

```java
public class GroupChatClient {
    private final String host;
    private final int port;
    public GroupChatClient(String host, int port) {
        this.host = host;
        this.port = port;
    }
    public void run(){
        EventLoopGroup eventLoopGroup = new NioEventLoopGroup();
        try{
            Bootstrap bootstrap = new Bootstrap()
                    .group(eventLoopGroup)
                    .channel(NioSocketChannel.class)
                    .handler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            pipeline.addLast("decoder", new StringDecoder());
                            pipeline.addLast("encoder", new StringEncoder());
                            pipeline.addLast(new GroupChatClientHandler());
                        }
                    });
            System.out.println("NETTY CLIENT IS READY");
            ChannelFuture channelFuture = bootstrap.connect(host, port).sync();
            Channel channel = channelFuture.channel();
            System.out.println("----"+channel.localAddress()+"---");

            Scanner scanner=new Scanner(System.in);
            while (scanner.hasNext()){
                String msg = scanner.nextLine();
                channel.writeAndFlush(msg+"\r\n");
            }
        }catch (Exception e){
            e.printStackTrace();
        }finally {
            eventLoopGroup.shutdownGracefully();
        }
    }
}
```

获取管道、向管道加入编码解码器和设置业务处理器`handler`的过程与服务端基本相同。与服务端明显不同的是，客户端需要输入发送给别人的信息，因此创建一个扫描器，接收来自键盘的输入。

客户端业务处理器，同样继承`SimpleChannelInboundHandler`：

```java
public class GroupChatClientHandler extends SimpleChannelInboundHandler<String> {
    @Override
    protected void channelRead0(ChannelHandlerContext ctx, String msg) throws Exception {
        System.out.println(msg.trim());
    }
}
```

相对于服务端相比非常简单，只需要打印接收的信息即可。

下面对这个过程进行一下测试，首先启动一个服务端和三个客户端，在服务端会打印客户端的上线信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6dc2906312e84584888dc338de869e9c~tplv-k3u1fbpfcp-zoom-1.image)

服务端启动时打印的信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b5816449356b44e5a643976630618b66~tplv-k3u1fbpfcp-zoom-1.image)

较早登录的客户端会收到服务端转发的其他客户端的上线信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1e22fe7ddb1b46dcbbc08c92582f5b9f~tplv-k3u1fbpfcp-zoom-1.image)

发送接收消息测试，会根据发送者的不同进行显示的区分：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85546335399441e59b3d9e3bc9c1baa6~tplv-k3u1fbpfcp-zoom-1.image)

其余客户端下线时，当前客户端会显示下线信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/548cedab62c748c0b074682b2838ce8d~tplv-k3u1fbpfcp-zoom-1.image)

服务端显示的下线信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/25b60eb9944e4f928131d7ebde7f8e7a~tplv-k3u1fbpfcp-zoom-1.image)

到这里，一个群聊系统的基本功能就已经实现了。需要注意的是，这里是不支持点对点的聊天的，如果再需要点对点的聊天，那么就不能使用`ChannelGroup`了，可以使用`HashMap`缓存各个`Channel`的信息，实现定向的消息发送。