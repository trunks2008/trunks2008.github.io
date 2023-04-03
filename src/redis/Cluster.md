---
title: Redis Cluster高可用集群搭建
icon: page
order: 6
author: Hydra
date: 2020-07-26
tag:
  - Redis 
  - 集群
star: true
---



<!-- more -->

在前面两篇文章中，分别介绍了Redis的主从复制 和 哨兵模式，这篇文章我们来介绍一下Redis官方推荐的集群部署方案Redis Cluster，以及它的动态扩容、缩容过程。

Redis Cluster集群是一个由多个主从节点群组成的分布式服务器群，它具有复制、高可用和分片特性。它不需要Sentinel哨兵也能完成节点移除和故障转移的功能，并且它的性能和高可用性均优于哨兵模式，集群配置也非常简单。

在配置过程中，需要将每个节点设置成集群模式，这种集群模式没有中心节点，可水平扩展，官方文档称可以线性扩展到 1000节点。

## 原生搭建

首先我们采用原生搭建的方式搭建3主3从的Redis Cluster，分别给3个master节点配置一个slave节点，总计6个Redis节点。

1、修改配置文件，先修改通用配置：

```shell
bind 0.0.0.0
port 7000
pidfile /var/run/redis_7000.pid
logfile "redis7000.log"
dbfilename dump7000.rdb
dir /home/hydra/files/redis/cluster/redis7000
masterauth 123456   
requirepass 123456
appendonly yes 
appendfilename "appendonly7000.aof"
```

再修改核心配置：

```shell
cluster-enabled yes
cluster-config-file nodes-7000.conf #这个config会保存集群配置
cluster-node-timeout 15000  #超时时间
cluster-replica-validity-factor 10
cluster-require-full-coverage  no  #重要配置
```

登陆redis-cli，使用`cluster nodes` 指令查看集群状态，现在集群下只存在当前一个节点：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d1308886b90243d69382220f44a5715a~tplv-k3u1fbpfcp-zoom-1.image)

其他5台Redis实例执行相同操作，完成后各自仍然处于独立状态。

2、集群节点关联

使用`meet`指令进行集群下节点的关联，在7000节点上执行：

```
cluster meet 127.0.0.1 7001
```

这样7000和7001节点就能通讯了，再执行`cluster nodes`，可以看见节点已经关联了。如果再关联一个节点，那么3个节点都会互相关联。继续执行：

```
cluster meet 127.0.0.1 7002
cluster meet 127.0.0.1 7003
cluster meet 127.0.0.1 7004
cluster meet 127.0.0.1 7005
```

这样6台redis实例就全部关联起来了：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/3c0b5bc18a6b4a02971e649a1d0e0624~tplv-k3u1fbpfcp-zoom-1.image)

但是可以看到，当前默认全都是`master`节点，没有从节点，仍然不能进行写入操作。

3、指派槽位（slot）

首先尝试向节点写入值，写入失败，提示没有分配`slot`槽位：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d9ed35b8b54a4d65bfd1e9d5ad75fd62~tplv-k3u1fbpfcp-zoom-1.image)

这里首先解释槽位的概念，Redis集群中内置了16384个哈希槽，当需要在 Redis集群中放置一条数据时，Redis先对key使用`crc16`算法算出一个结果，然后把结果对16384取余，这样每个key都会对应一个编号在0-16383之间的哈希槽，Redis会根据节点数量大致均等的将哈希槽映射到不同的节点。映射流程如下图所示：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85973ee2c631454493504d659f285b7b~tplv-k3u1fbpfcp-zoom-1.image)

当前配置架构为3主3从形式，平均分配16384个槽位：

- 节点7000分配：0-5461
- 节点7001分配：5462-10922
- 节点7002分配：10923-16383

分配槽位指令：

```shell
cluster addslots slot #slot为槽位下标
```

那么在redis7000实例上就需要执行：

```shell
cluster addslots 0
...
cluster addslots 5461
```

如果要所有key值都能正常执行，需要手动执行16384次，因此创建脚本进行批量执行：

```shell
start=$1
end=$2
port=$3
for slot in `seq ${start} ${end}`
do
    echo "slot:${slot}"
    /home/hydra/files/redis/redis-5.0.4/src/redis-cli -h 127.0.0.1 -p ${port} -a 123456 cluster addslots ${slot}
done
```

执行shell脚本：

```shell
ssh addslots.sh 0 5461 7000
sh addslots.sh 5462 10922 7001
sh addslots.sh 10923 16383 7002
```

查看集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fbdb30ec7200443385a0dfb794db4b44~tplv-k3u1fbpfcp-zoom-1.image)

显示槽位分配成功，需要注意在Redis Cluster中，只有master主机才有槽位的概念，从机不需要分配槽位。当前我们采用的是平均分配的方式，在实际环境下，如果服务器性能有差别，可以往性能好的服务器多分配一些槽位。

4、分配主从

Redis cluster分配主从命令：

```
cluster replicate node-id
```

如果要让7003作为7000的从机，首先登录7003，执行：

```
cluster replicate  9d73de74af827cd5025dcd3910d8c2919d9aa24b
```

后面的40位id为redis7000的node-id。继续将redis7004的主机指派为redis7001，reids7005的主机指派为redis7002。查看集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5208cf53ac224769bed3b263828bd986~tplv-k3u1fbpfcp-zoom-1.image)

其中，集群的信息会被保存到集群的配置信息会存到`redis700x/node-700x.conf`的配置文件中。

以集群方式运行客户端，在redis-cli加上启动参数`-c`：

```
../redis-5.0.4/src/redis-cli -h 172.16.67.134 -p 7000 -a 123456 -c
```

尝试写入数据，不同数据会根据槽位不同被写到不同主机上：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/b31c65b90f394ce68bd3e13d87f13aa7~tplv-k3u1fbpfcp-zoom-1.image)

到这，3主3从的架构的Redis Cluster就搭建完毕了。

## 快速搭建

除了手动使用命令搭建Redis Cluster外，还可以使用Redis提供的内置指令来进行一键快速搭建。首先，与手动搭建相同，先修改配置文件，配置与上面完全相同，修改完成后启动。

启动完成后，使用`cluster create`指令进行搭建：

```shell
../redis-5.0.4/src/redis-cli --cluster create 
    127.0.0.1:8000 127.0.0.1:8001 127.0.0.1:8002 
    127.0.0.1:8003 127.0.0.1:8004 127.0.0.1:8006 
    --cluster-replicas 1  -a 123456
```

这里的`--cluster-replicas 1` 表示1主1从架构。如果要分配为1主2从，那么就要写成：

```
--cluster-replicas 2
```

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/542343f9193947c3929d656e3b2eb111~tplv-k3u1fbpfcp-zoom-1.image)

输入`yes`进行确认：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ee94cf6b555e4acba8ac1d815ac9d63e~tplv-k3u1fbpfcp-zoom-1.image)

搭建完成，查看一下集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bea964b59dd941c3b6e4fc3ea2b05d19~tplv-k3u1fbpfcp-zoom-1.image)

包括`meet`，槽位分配和主从分配全部自动完成。

## 集群扩容

1、准备新节点

新建两个redis7006，redis7007，将之前的配置文件拷过来，启动实例。这时候这两个是孤立的节点:

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/22bbc212ede547f881b51704735bed3d~tplv-k3u1fbpfcp-zoom-1.image)

2、将新的主节点加入集群，使用redis-cli，语法为如下：

```shell
--cluster add-node <newNode ip:port> <oldNode ip:port>
```

执行：

```shell
../redis-5.0.4/src/redis-cli --cluster 
  add-node 127.0.0.1:7006 127.0.0.1:7000 -a 123456
```

执行完成后，新节点被加入集群中：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4bee9f701ad245e5bde16632d0c5aa0f~tplv-k3u1fbpfcp-zoom-1.image)

添加完成后，默认加进来是master节点，并且没有分配槽位：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/13956ffb81784e3da8ac510fc2a60256~tplv-k3u1fbpfcp-zoom-1.image)

3、添加从节点，并指定它的主节点，语法如下：

 ```shell
--cluster add-node <newIp:port> <oldIp:port> --cluster-slave --cluster-master-id masterID
 ```

执行：

```
../redis-5.0.4/src/redis-cli --cluster add-node 
  127.0.0.1:7007 127.0.0.1:7000  
  --cluster-slave --cluster-master-id edc8ff41aef320beb5081c5b50bf32485a7ffb9e 
  -a 123456
```

redis7007被指定为redis7006的从节点：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e6dd9a4411f8448d89ff67a2d5984dee~tplv-k3u1fbpfcp-zoom-1.image)

查看集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/57c1b478ba134ed8ad4ee0c7b566e023~tplv-k3u1fbpfcp-zoom-1.image)

4、迁移槽位和数据，语法如下：

```
/redis-cli --cluster reshard <ip:port>
```

执行：

```
../redis-5.0.4/src/redis-cli --cluster reshard 172.16.67.134:7000  -a 123456
```

迁移过程中，会进行询问：

- `How many slots do you want to move (from 1 to 16384)? ` 提示要分配多少槽，我们平均分到4个实例，所以输入4096
- `What is the receiving node ID? ` 接收节点ID：输入7006的`node-id`
- `【all/done】` 从哪些分配，如果选择`all`，所有节点平均分配，或手动输入`node-id`分配，`done`结束

查看集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f701e83975244d38a4d67b5356136667~tplv-k3u1fbpfcp-zoom-1.image)

分配完成后，可以查看7006的槽位，看出3个主节点每个都给它分配了一些槽位：

- 0-1365
- 5462-6826
- 10923-12287

## 集群缩容

在集群缩容中，我们需要先删除槽位，再删除节点。如果直接删除一个主节点，那么它的从节点就会变成主节点。

1、下线迁移槽，语法如下：

```shell
redis-cli --cluster reshard --cluster-from 要迁出节点ID   
  --cluster-to 接收槽节点ID 
  --cluster-slots 迁出槽数量   已存在节点ip 端口
```

首先将7006的 0-1365迁移回7000，执行：

```
../redis-5.0.4/src/redis-cli --cluster reshard    
   --cluster-from  edc8ff41aef320beb5081c5b50bf32485a7ffb9e   
   --cluster-to 9d73de74af827cd5025dcd3910d8c2919d9aa24b   
   --cluster-slots 1366 127.0.0.1 7000 -a 12345
```

之后同样的方式将其余槽位迁移回redis7001和redis7002节点。执行完成后，redis7006上的槽位全部被迁移回3台主机：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/da7f647ee3ce4bd6aacb16d8184808b2~tplv-k3u1fbpfcp-zoom-1.image)

2、删除节点，语法如下： 

```
redis-cli --cluster del-node 已存在节点ID：端口 要删除的节点ID
```

先删除7006：

```shell
../redis-5.0.4/src/redis-cli --cluster del-node    
  127.0.0.1:7000 edc8ff41aef320beb5081c5b50bf32485a7ffb9e   
  -a 123456
```

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/701217322aec4aba96bb988f2f2887bd~tplv-k3u1fbpfcp-zoom-1.image)

执行完成后，节点会关机，后台会直接杀死redis7006的进程。再看一下集群状态：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/2147267ab607470383a37de8ffa9045e~tplv-k3u1fbpfcp-zoom-1.image)

这时候会把redis7007分配给其他的主节点作为从节点，这是因为redis7006没有槽位和数据，因此没有发生故障转移，把redis7007升级为主节点。那么我们再看一下故障转移过程，使用kill指令杀死redis7000进程后：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/1365aa662a9743e7a243bcc3cf5a4a96~tplv-k3u1fbpfcp-zoom-1.image)

redis7000变成`fail`状态，并且它的从机redis7003继承了它的槽位和数据。