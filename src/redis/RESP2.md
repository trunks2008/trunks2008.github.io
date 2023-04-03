---
title: Redis：我是如何与客户端进行通信的
icon: page
order: 9
author: Hydra
date: 2021-06-22
tag:
  - RESP
  - Redis
star: true
---



<!-- more -->

江湖上说，**天下武功，无坚不摧，唯快不破**，这句话简直是为我量身定制。

我是一个Redis服务，最引以为傲的就是我的速度，我的 QPS 能达到10万级别。

在我的手下有数不清的小弟，他们会时不时到我这来存放或者取走一些数据，我管他们叫做客户端，还给他们起了英文名叫 Redis-client。

有时候一个小弟会来的非常频繁，有时候一堆小弟会同时过来，但是，即使再多的小弟我也能管理的井井有条。

有一天，小弟们问我。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/30750a839884466594c4ed9b32d8e1a3~tplv-k3u1fbpfcp-zoom-1.image)

想当年，为了不让小弟们拖垮我傲人的速度，在设计和他们的通信协议时，我绞尽脑汁，制定了下面的三条原则：

- 实现简单
- 针对计算机来说，解析速度快
- 针对人类来说，可读性强

为什么这么设计呢？先来看看一条指令发出的过程，首先在客户端需要对指令操作进行封装，使用网络进行传输，最后在服务端进行相应的解析、执行。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d10f2c143891433aa1e9b03347368ec0~tplv-k3u1fbpfcp-zoom-1.image)

这一过程如果设计成一种非常复杂的协议，那么封装、解析、传输的过程都将非常耗时，无疑会降低我的速度。什么，你问我为什么要遵循最后一条规则？算是对于程序员们的馈赠吧，我真是太善良了。

我把创造出来的这种协议称为 RESP (`REdis Serialization Protocol`)协议，它工作在 TCP 协议的上层，作为我和客户端之间进行通讯的标准形式。

说到这，我已经有点迫不及待想让你们看看我设计出来的杰作了，但我好歹也是个大哥，得摆点架子，不能我主动拿来给你们看。

所以我建议你直接使用客户端发出一条向服务器的命令，然后取出这条命令对应的报文来直观的看一下。话虽如此，不过我已经被封装的很严实了，正常情况下你是看不到我内部进行通讯的具体报文的，所以，你可以**伪装**成一个Redis的服务端，来截获小弟们发给我的消息。

实现起来也很简单，我和小弟之间是基于 Socket 进行通讯，所以在本地先启动一个`ServerSocket`，用来监听Redis服务的6379端口：

```java
public static void server() throws IOException {
    ServerSocket serverSocket = new ServerSocket(6379);
    Socket socket = serverSocket.accept();
    byte[] bytes = new byte[1024];
    InputStream input = socket.getInputStream();
    while(input.read(bytes)!=0){
        System.out.println(new String(bytes));
    }
}
```

然后启动`redis-cli`客户端，发送一条命令：

```shell
set key1 value1
```

这时，伪装的服务端就会收到报文了，在控制台打印了：

```properties
*3
$3
set
$4
key1
$6
value1
```

看到这里，隐隐约约看到了刚才输入的几个关键字，但是还有一些其他的字符，要怎么解释呢，是时候让我对协议报文中的格式进行一下揭秘了。

我对小弟们说了，对大哥说话的时候得按规矩来，这样吧，你们在请求的时候要遵循下面的规则：

```properties
*<参数数量> CRLF
$<参数1的字节长度> CRLF
<参数1的数据> CRLF
$<参数2的字节长度> CRLF
<参数2的数据> CRLF
...
$<参数N的字节长度> CRLF
<参数N的数据> CRLF
```


首先解释一下每行末尾的`CRLF`，转换成程序语言就是`\r\n`，也就是回车加换行。看到这里，你也就能够明白为什么控制台打印出的指令是竖向排列了吧。

在命令的解析过程中，`set`、`key1`、`value1`会被认为是3个参数，因此参数数量为3，对应第一行的`*3`。

第一个参数`set`，长度为3对应`$3`；第二个参数`key1`，长度为4对应`$4`；第三个参数`value1`，长度为6对应`$6`。在每个参数长度的下一行对应真正的参数数据。

看到这，一条指令被转换为协议报文的过程是不是就很好理解了？

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f7dcbd34018542459812c1f481e35002~tplv-k3u1fbpfcp-zoom-1.image)

当小弟对我发送完请求后，作为大哥，我就要对小弟的请求进行**指令回复**了，而且我得根据回复内容进行一下分类，要不然小弟该搞不清我的指示了。

#### 简单字符串

简单字符串回复只有一行回复，回复的内容以`+`作为开头，不允许换行，并以`\r\n`结束。有很多指令在执行成功后只会回复一个`OK`，使用的就是这种格式，能够有效的将传输、解析的开销降到最低。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/93bc274a43c14b4b9931632228e2c965~tplv-k3u1fbpfcp-zoom-1.image)

#### 错误回复

在RESP协议中，错误回复可以当做简单字符串回复的变种形式，它们之间的格式也非常类似，区别只有第一个字符是以`-`作为开头，错误回复的内容通常是错误类型及对错误描述的字符串。

错误回复出现在一些异常的场景，例如当发送了错误的指令、操作数的数量不对时，都会进行错误回复。在客户端收到错误回复后，会将它与简单字符串回复进行区分，视为异常。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f1b2c578f9b449cba9c1072ff35522a4~tplv-k3u1fbpfcp-zoom-1.image)

#### 整数回复

整数回复的应用也非常广泛，它以`:`作为开头，以`\r\n`结束，用于返回一个整数。例如当执行`incr`后返回自增后的值，执行`llen`返回数组的长度，或者使用`exists`命令返回的0或1作为判断一个`key`是否存在的依据，这些都使用了整数回复。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14a8b09718864bd2bedd9e7c4c70eb14~tplv-k3u1fbpfcp-zoom-1.image)

#### 批量回复

批量回复，就是多行字符串的回复。它以`$`作为开头，后面是发送的字节长度，然后是`\r\n`，然后发送实际的数据，最终以`\r\n`结束。如果要回复的数据不存在，那么回复长度为-1。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/898ad1187901482ea6cd6051a22ee96f~tplv-k3u1fbpfcp-zoom-1.image)

#### 多条批量回复

当服务端要返回多个值时，例如返回一些元素的集合时，就会使用多条批量回复。它以`*`作为开头，后面是返回元素的个数，之后再跟随多个上面讲到过的批量回复。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/9837a15ec9224223ad347a207ea08794~tplv-k3u1fbpfcp-zoom-1.image)

到这里，基本上我和小弟之间的通讯协议就介绍完了。刚才你尝试了伪装成一个服务端，这会再来试一试直接写一个客户端来直接和我进行交互吧。

```java
private static void client() throws IOException {
    String CRLF="\r\n";

    Socket socket=new Socket("localhost", 6379);
    try (OutputStream out = socket.getOutputStream()) {
        StringBuffer sb=new StringBuffer();
        sb.append("*3").append(CRLF)
                .append("$3").append(CRLF).append("set").append(CRLF)
                .append("$4").append(CRLF).append("key1").append(CRLF)
                .append("$6").append(CRLF).append("value1").append(CRLF);
        out.write(sb.toString().getBytes());
        out.flush();

        try (InputStream inputStream = socket.getInputStream()) {
            byte[] buff = new byte[1024];
            int len = inputStream.read(buff);
            if (len > 0) {
                String ret = new String(buff, 0, len);
                System.out.println("Recv:" + ret);
            }
        }
    }
}
```

运行上面的代码，控制台输出：

```prop
Recv:+OK
```

上面模仿了客户端发出`set`命令的过程，并收到了回复。依此类推，你也可以自己封装其他的命令，来实现一个自己的Redis客户端来和我进行通信。

**不过记住，要叫我大哥。**