---
title: 基于Netty，20分钟手撸一个RPC框架
icon: page
order: 1
author: Hydra
date: 2020-06-10
tag:
  - Netty
  - RPC
star: true
---



<!-- more -->

Netty是一款高性能的网络传输框架，作为基础通信组件被RPC框架广泛使用。例如`Dubbo`协议中使用它进行节点间通信，`Hadoop`中的`Avro`组件使用它进行数据文件共享。那么我们就来尝试使用Netty，实现一个简单的RPC框架。

首先我们先抽象出一个服务的API接口，服务提供者实现这个接口中的方法，服务消费者直接调用接口进行访问：

```java
public interface TestService {
    String test(String message);
}
```

服务方实现该接口，供消费者调用：

```java
public class TestServiceImpl implements TestService {
    @Override
    public String test(String message) {
        System.out.println("Server has received:"+ message);
        if (message !=null){
            return "hi client, Server has Received:["+ message+"]";
        }else{
            return "empty message";
        }
    }
}
```

然后我们开始使用Netty创建服务的Server端：

```java
public class NettyServer {
    public static void startServer(String hostname,int port){
        EventLoopGroup bossGroup=new NioEventLoopGroup(1);
        EventLoopGroup workerGroup=new NioEventLoopGroup();
        try{
            ServerBootstrap serverBootstrap = new ServerBootstrap();
            serverBootstrap.group(bossGroup,workerGroup)
                    .channel(NioServerSocketChannel.class)
                    .childHandler(new ChannelInitializer<SocketChannel>() {
                        @Override
                        protected void initChannel(SocketChannel ch) throws Exception {
                            ChannelPipeline pipeline = ch.pipeline();
                            pipeline.addLast(new StringDecoder());
                            pipeline.addLast(new StringEncoder());
                            pipeline.addLast(new NettyServerHandler());
                        }
                    });
            ChannelFuture future = serverBootstrap.bind(hostname, port).sync();
            System.out.println("服务端启动");
            future.channel().closeFuture().sync();
        }catch (Exception e){
            e.printStackTrace();
        }finally {
            bossGroup.shutdownGracefully();
            workerGroup.shutdownGracefully();
        }
    }
}
```

在创建Server端时，我们在`ChannelPipeline`中添加了Netty自带的String类型的编码器与解码器，最后添加我们的业务逻辑处理的`handler`。

类似于Dubbo在调用中使用了自己的Dubbo协议，我们在调用服务之前，也需要自定义我们的协议，如果接收到的消息不是按照我们定义的协议，则不予处理。这里定义一个简单的协议，来规定我们的消息的开头以什么开始：

```java
public class Protocol {
    public static final String HEADER="My#Protolcol#Header#";
}
```

创建服务端的`handler`，用于处理业务逻辑。新建一个类继承`ChannelInboundHandlerAdapter` ，通过`channelRead`方法接收客户端发送的消息，在方法中判断消息是否以我们自定义的协议头开头，如果是则读取消息，并调用本地方法，最后通过`writeAndFlush`返回调用的结果。

```java
public class NettyServerHandler extends ChannelInboundHandlerAdapter {
    @Override
    public void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        System.out.println("msg="+msg);
        if(msg.toString().startsWith(Protocol.HEADER)){
            String result = new TestServiceImpl().test(msg.toString().substring(msg.toString().lastIndexOf("#") + 1));
            ctx.writeAndFlush(result);
        }
    }
    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();
        ctx.close();
    }
}
```

至此，服务端我们就已经写完了，再开始写客户端。因为客户端的代码有一点特殊性，所以我们先写处理业务逻辑的`NettyClientHandler`，之后再实现`client`端的Netty初始化方法。

在`handler`中，我们要使用多线程来调用服务端的服务，使用`channelRead`接收服务端返回的结果，所以除了继承`ChannelInboundHandlerAdapter`父类外，还要实现`Callable`接口，并重写其中的`call`方法。

```java
public class NettyClientHandler extends ChannelInboundHandlerAdapter implements Callable {
    private ChannelHandlerContext context;
    //返回的结果
    private String result;
    //客户端调用方法时，传入的参数
    private String param;

    @Override
    public void channelActive(ChannelHandlerContext ctx) throws Exception {
        context = ctx;
    }

    @Override
    public synchronized void channelRead(ChannelHandlerContext ctx, Object msg) throws Exception {
        result = msg.toString();
        //唤醒等待线程
        notify();
    }

    @Override
    public synchronized Object call() throws Exception {
        context.writeAndFlush(param);
        wait();
        return result;
    }

    @Override
    public void exceptionCaught(ChannelHandlerContext ctx, Throwable cause) throws Exception {
        cause.printStackTrace();
        ctx.close();
    }

    public void setParam(String param) {
        this.param = param;
    }
}
```

在上面的代码中，创建了变量`context`用于存储当前`handler`的`ChannelHandlerContext`，这是为了在`call`方法中使用该`context`发送消息。与服务器的连接创建后，首先会执行`channelActive`方法，给该`context`赋值。

需要注意的是，`call`方法和`channelRead`方法的`synchronized`关键字非常重要，在执行`wait`方法的时候会释放锁，从而使`channelRead`方法获取锁，在读取到服务端返回的消息后使用`notify`唤醒`call`方法的线程，返回结果。

说完了`NettyClientHandler` ，我们回过头来写Netty客户端的启动类`NettyClient`。首先，我们创建一个线程池，用来在后面执行访问的请求，线程池的大小定义为我们的cpu可用线程数。

```java
private static ExecutorService executor 
      = Executors.newFixedThreadPool(Runtime.getRuntime().availableProcessors());
```

因为客户端调用的是接口，需要使用代理模式创建代理对象，我们创建一个`getProxy`方法用来获取代理对象并进行方法增强：

```java
public Object getProxy(final Class<?> serviceClass, final String protocolHead) {
    return Proxy.newProxyInstance(this.getClass().getClassLoader(), new Class<?>[]{serviceClass}, new InvocationHandler() {
        @Override
        public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
            if (clientHandler == null) {
                initClient();
            }
            clientHandler.setParam(protocolHead + args[0]);
            return executor.submit(clientHandler).get();
        }
    });
}
```

这里调用了线程池的`submit`方法提交任务，调用`handler`中的`call`方法发送请求。上面的`args[0]`是调用时的参数，`initClient`方法用于初始化Netty的`client`端，代码如下：

```java
private static void initClient() {
    clientHandler = new NettyClientHandler();
    NioEventLoopGroup group = new NioEventLoopGroup();
    try {
        Bootstrap bootstrap = new Bootstrap();
        bootstrap.group(group)
                .channel(NioSocketChannel.class)
                .option(ChannelOption.TCP_NODELAY, true)
                .handler(
                        new ChannelInitializer<SocketChannel>() {
                            @Override
                            protected void initChannel(SocketChannel ch) throws Exception {
                                ChannelPipeline pipeline = ch.pipeline();
                                pipeline.addLast(new StringDecoder());
                                pipeline.addLast(new StringEncoder());
                                pipeline.addLast(clientHandler);
                            }
                        }
                );
        bootstrap.connect("127.0.0.1", 7000).sync();
        System.out.println("客户端启动");
    } catch (Exception e) {
        e.printStackTrace();
    }
}
```

`NettyClient`端的`ChannelPipeline`中同样添加了编码解码器，与我们自己实现的业务逻辑`handler`。

至此，客户端与服务端的功能就完成了，我们创建启动类，先启动服务端：

```java
public class ProviderBootstrap {
    public static void main(String[] args) {
        NettyServer.startServer("127.0.0.1",7000);
    }
}
```

再启动客户端：

```java
public class ConsumerBootstrap {
    public static void main(String[] args) {
        NettyClient consumer = new NettyClient();
        TestService proxy =(TestService) consumer.getProxy(TestService.class, Protocol.HEADER);
        String result = proxy.test("hi,i am client");
        System.out.println("result: "+result);
    }
}
```

最后看一下运行结果，先看服务提供者：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1fbfa65b44f14af3ace1946ab9852781~tplv-k3u1fbpfcp-zoom-1.image)

收到的消息以我们的协议开头，将协议头剔除后获得消息正文，作为RPC调用方法的参数，传递给请求的方法。再看服务消费者端：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/040db9f1d5174d4baefd97266645f6f2~tplv-k3u1fbpfcp-zoom-1.image)

接收到了服务提供端返回的信息。这样，一个简单的RPC框架就已经实现了。