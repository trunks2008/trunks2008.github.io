---
title: 警惕！你的Docker可能正在被挖矿！
icon: page
order: 7
author: Hydra
date: 2020-08-02
tag:
  - Docker
  - 挖矿
star: true
---



<!-- more -->

事情是这样的，前段时间的周末刚在外面坐下准备吃个饭，突然收到一条短信：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d1b21fffa39248efa298ab41cf99122a~tplv-k3u1fbpfcp-zoom-1.image)

什么情况？我一个小小的个人服务器都能被挖矿？回想了一下，也没想到之前做了什么能引起被挖矿的操作啊，直到两个小时后，又收到一条短信报警：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/90d2eff674c441d9815313e48193f9f2~tplv-k3u1fbpfcp-zoom-1.image)

端口？提到端口我想起来了，自己前一天因为要用idea连接服务器上的docker，开启了一个2375的端口。至于具体操作，就是简单修改了一下配置文件`/usr/lib/systemd/system/docker.service/usr/lib/systemd/system/docker.servicevv`，修改了下面的内容：

```shell
ExecStart=/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock
```

在这句后面添加了一句：

```shell
-H tcp://0.0.0.0:2375
```

这样，就开启了一个2375端口，通过这个端口，可以在idea中配置docker，并在打包的同时进行镜像的上传：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/02b13c01c24d4dd08071552554980a00~tplv-k3u1fbpfcp-zoom-1.image)

通过这个端口，我们就可以直接对远程的`docker daemon`进行操作了。

## 紧急处理

既然找到了问题所在，那我们就得立马处理这个问题了。回到家，马上在安全配置里关闭了2375端口的外网访问：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/741c7d3ee3af48788c08bc8aefdd0f45~tplv-k3u1fbpfcp-zoom-1.image)

再看一下后台的报警信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e36b6e8ef017480087bda023ef0fa539~tplv-k3u1fbpfcp-zoom-1.image)

使用`kill`命令杀死这个进程：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/07d2f9fb2b694c66bd07134b0c575c5b~tplv-k3u1fbpfcp-zoom-1.image)

好了，这下进程也杀死了，外网的端口访问也关闭了，应该没事了吧？没想到晚上7点多，又连着报了两条警告信息：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5446301ae7df4cffb3791db2be470e76~tplv-k3u1fbpfcp-zoom-1.image)

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4bc4912eefe14bf59cefbbdc552959e6~tplv-k3u1fbpfcp-zoom-1.image)

使用`ps`指令看一下13102进程，没有查到。查一下`masscan`进程，能够找到，这个`masscan`是一个端口扫描工具，能够根据IP地址的范围和端口号，快速进行端口扫描：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c55640891b414da3a351d8aba2828af5~tplv-k3u1fbpfcp-zoom-1.image)

顺便查询了下父进程的`pid`，居然使用了`portainer`，居然连docker的图形化管理界面都帮我安装上了。需要注意的是在杀死`masscan`进程前，一定要杀死父进程，否则`masscan`进程会不断重启。

再看一下第二个报警的32452进程，能够找到`docker-cache`进程，使用`kill`杀死后不会进行重启。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/6b66dc118a754b7abe04df2af47d7cbd~tplv-k3u1fbpfcp-zoom-1.image)

停止运行的容器并删除：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/28c91f03f2a04e608a4bc19bf720f05b~tplv-k3u1fbpfcp-zoom-1.image)

删除挖矿`image`：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/409227faa37442788512b544d12d5aa0~tplv-k3u1fbpfcp-zoom-1.image)

修改配置文件，删掉2375端口的`tcp`连接，然后重启docker：

```shell
systemctl daemon-reload
systemctl  start docker
```

## 入侵原理

到这，先总结一下为什么能够通过2375端口入侵宿主主机？

- docker对`user namespace`没有做隔离，也就是说，容器内部的`root`用户就是宿主机的`root`用户，一旦挂载目录，就可以在容器内部以宿主机的`root`用户身份对挂载的文件系统随意修改了
- docker服务拥有很高的执行权利(相当于`root`)，并且在docker用户组下的普通用户不需要任何其他验证就可以执行`docker run`等命令
- 而暴露的`docker remote` API端口如果没有启动`ssl`验证的话，任何能连通到这台docker宿主机的的机器都可以随意操作这台docker宿主机的`docker daemon`

## 漏洞修复

那么应该如何修复这个漏洞呢，通过查阅资料，docker本身提供了加密的远程管理端口2376，配合CA证书，就能提供`TLS`连接了。

首先要准备5个证书和秘钥文件，分别是`ca.pem`、`server-cert.pem`、`server-key.pem`、`client-cert.pem`和`client-key.pem`。其中，`server-cert.pem`中限制了能够访问Docker主机的客户端列表。

启动`docker deamon`时，需要设置`-H`、`–tls`、`–tlscacert=ca.pem`、`–tlscert=server-cert.pem`和`–tlskey=server-key.pem`。此时，只有客户端列表中的主机能够访问docker主机。

1.生成CA私钥`ca-key.pem`，使用该私钥对CA证书签名

```shell
openssl genrsa -out ~/docker/ca-key.pem 4096
```

2.使用CA私钥生成自签名CA证书`ca.pem`。生成证书时，通过`-days 365`设置证书的有效期。单位为天，默认情况下为30天

```shell
openssl req -x509 -sha256 -batch -subj '/C=CN/ST=Sichuan/L=Chengdu/O=Ghostcloud Co.,Ltd/OU=Laboratory/CN=www.ghostcloud.cn' -new -days 365 -key ~/docker/ca-key.pem -out ~/docker/ca.pem
```

3.生成服务器私钥`server-key.pem`和`CSR(Certificate Signing Request)server-csr.pem`

```shell
openssl genrsa -out ~/docker/server-key.pem 4096
openssl req -subj '/CN=DockerDaemon' -sha256 -new -key ~/docker/server-key.pem -out ~/docker/server-csr.pem
```

4.使用CA证书生成服务器证书`server-cert.pem`。TLS连接时，需要限制客户端的IP列表或者域名列表。只有在列表中的客户端才能通过客户端证书访问`docker daemon`

```shell
echo subjectAltName = IP:127.0.0.1,IP:192.168.1.100 > ~/docker/allow.list
openssl x509 -req -days 365 -sha256 -in ~/docker/server-csr.pem -CA ~/docker/ca.pem -CAkey ~/docker/ca-key.pem -CAcreateserial -out ~/docker/server-cert.pem -extfile ~/docker/allow.list
```

5.生成客户端私钥`client-key.pem`和`CSRclient-csr.pem`

```shell
openssl genrsa -out ~/docker/client-key.pem 4096
openssl req -subj '/CN=DockerClient' -new -key ~/docker/client-key.pem -out ~/docker/client-csr.pem
```

6.使用CA证书生成客户端证书`client-cert.pem`。需要加入`extendedKeyUsage`选项

```shell
echo extendedKeyUsage = clientAuth > ~/docker/options.list
openssl x509 -req -days 365 -sha256 -in ~/docker/client-csr.pem -CA ~/docker/ca.pem -CAkey ~/docker/ca-key.pem -CAcreateserial -out ~/docker/client-cert.pem -extfile ~/docker/options.list
```

7.成功生成了需要的证书和秘钥，可以删除临时文件

```shell
rm -f ~/docker/server-csr.pem ~/docker/client-csr.pem ~/docker/allow.list ~/docker/options.list
```

8.为了保证证书和私钥的安全，需要修改文件的访问权限

```shell
chmod 0444 ~/docker/ca.pem ~/docker/server-cert.pem ~/docker/client-cert.pem
chmod 0400 ~/docker/ca-key.pem ~/docker/server-key.pem ~/docker/client-key.pem
```

9.重启`docker daemon`，加入`ca.pem`、`server-cert.pem`和`server-key.pem`。`-H=0.0.0.0:2376`表示`docker daemon`监听在2376端口

```shell
docker daemon --tlsverify --tlscacert=~/docker/ca.pem --tlscert=~/docker/server-cert.pem --tlskey=~/docker/server-key.pem -H=0.0.0.0:2376
```

10.在客户端，运行docker命令时，加入`ca.pem`、`client-cert.pem`和`client-key.pem`

```shell
docker --tlsverify --tlscacert=~/docker/ca.pem --tlscert=~/docker/client-cert.pem --tlskey=~/docker/client-key.pem -H=tcp://127.0.0.1:2376 info
Containers: 41 Running: 16 Paused: 0 Stopped: 25 Images: 821 Server Version: 1.10.3 
```

这样，就可以安全的远程控制docker主机了。