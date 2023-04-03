---
title: Redis哨兵搭建与原理分析
icon: page
order: 5
author: Hydra
date: 2021-05-17
tag:
  - Redis
  - 哨兵
star: true
---



<!-- more -->

在Redis主从复制架构这篇文章中我们分析了主从复制的特点，其中一个问题就是主机宕机后需要手动调整，修改从机为主机，不仅不利于迅速恢复生产场景，还会增加人力成本。哨兵模式的出现是就是为了解决我们主从复制模式中需要我们人为操作的东西变为自动版，并且它比人为要更及时。这篇文章我们就来讲讲如何通过哨兵模式，迅速实现自动故障转移。

## 一、哨兵主要功能

Redis中的哨兵具有以下的功能：

- 监控（`Monitoring`）：哨兵会不断地检查主节点和从节点是否运作正常。
- 自动故障转移（`Automatic Failover`）：当主节点不能正常工作时，哨兵会开始自动故障转移操作，它会将失效主节点的其中一个从节点升级为新的主节点，并让其他从节点改为复制新的主节点。
- 配置提供者（`Configuration Provider`）：客户端在初始化时，通过连接哨兵来获得当前Redis服务的主节点地址。
- 通知（`Notification`）：哨兵可以将故障转移的结果发送给客户端。

其中，监控和自动故障转移功能，使得哨兵可以及时发现主节点故障并完成转移；而配置提供者和通知功能，则需要在与客户端的交互中才能体现。

## 二、哨兵模式架构

哨兵模式下，可以将节点类型分为数据节点和哨兵节点：

- 数据节点：主从架构中的主节点和从节点都是数据节点。
- 哨兵节点：哨兵系统由一个或多个哨兵节点组成，哨兵节点是特殊的Redis节点，不存储数据。

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5b34665c3b354cec84e92ff4f64c5042~tplv-k3u1fbpfcp-zoom-1.image)

在上图的架构中，除使用1主2从外，还额外使用了3个哨兵来监视集群状况。

## 三、搭建哨兵模式

1、部署主从节点

哨兵系统中的主从节点，与普通的主从节点配置是一样的，并不需要做任何额外配置，继续使用上篇文章的配置即可。注意使用哨兵模式下，一定要开启`materauth`配置密码： 

```shell
masterauth 123456
```

2、部署哨兵节点

拷贝安装目录下的配置文件`sentinel.conf`到自己新建的`sentinel`目录下，并重命名为`sentinel28000.conf`，以便和之后的哨兵通过端口进行区分。

修改配置文件，首先修改通用配置：

```shell
bind 0.0.0.0
protected-mode no
port 28000
daemonize yes
pidfile /var/run/redis-sentinel28000.pid
logfile "sentinel28000.log"
dir /tmp
```

修改哨兵核心配置，如果只配置一台哨兵，只需要修改以下配置：

```shell
sentinel monitor mymaster 127.0.0.1 8000 2
sentinel auth-pass mymaster 123456
```

看一下官方注释中的格式：

```shell
sentinel monitor <master-name> <ip> <redis-port> <quorum>  
```

- `master-name`指定了主节点名称
- `ip`和`redis-port`指定了主节点地址
- `quorum`是判断主节点客观下线的哨兵数量阈值：当判定主节点下线的哨兵数量达到`quorum`时，对主节点进行客观下线。建议取值为哨兵数量的一半加1

```
sentinel auth-pass <master-name> <password>
```

当在Redis实例中开启了`requirepass foobared` 授权密码后，所有连接Redis实例的客户端都要提供密码。设置哨兵`sentinel `连接主从的密码，注意必须为主从设置一样的验证密码。

其他配置参数：

```
sentinel down-after-milliseconds mymaster 30000
```

该参数与主观下线的判断有关：哨兵使用`ping`命令对其他节点进行心跳检测，如果其他节点超过`down-after-milliseconds`配置的时间没有回复，哨兵就会将其进行主观下线。该配置对主节点、从节点和哨兵节点的主观下线判定都有效。

```
sentinel parallel-syncs mymaster 1
```

该参数与故障转移之后从节点的复制有关：它规定了每次向新的主节点发起复制操作的从节点个数。

例如，假设主节点切换完成之后，有3个从节点要向新的主节点发起复制：

- 如果parallel-syncs=1，则从节点会一个一个开始复制
- 如果parallel-syncs=3，则3个从节点会一起开始复制

`parallel-syncs`取值越大，从节点完成复制的时间越快，但是对主节点的网络负载、硬盘负载造成的压力也越大，应根据实际情况设置。

这里我们使用3台哨兵，因此复制配置文件`sentinel28001.conf`和`sentinel28002.conf`，并批量替换其中的端口号为28001和28002。

3、启动哨兵节点

```
../redis-5.0.4/src/redis-sentinel sentinel28000.conf
../redis-5.0.4/src/redis-sentinel sentinel28001.conf
../redis-5.0.4/src/redis-sentinel sentinel28002.conf
```

除此之外，也可以使用下面的命令启动，效果相同：

```
../redis-5.0.4/src/redis-server sentinel28002.conf --sentinel
```

查看运行进程：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/d1eb90c32d4e400886b90d99d9bdc392~tplv-k3u1fbpfcp-zoom-1.image)

可以看出，现在主从运行3台Redis实例，并配置了3台哨兵。

4、使用Jedis客户端进行测试

```java
public class RedisSentinelTest {
    public static void main(String[] args)  {
        Set<String> set=new HashSet<>();
        set.add("172.20.5.179:28000");
        set.add("172.20.5.179:28001");
        set.add("172.20.5.179:28002");
        JedisSentinelPool jedisSentinelPool=new JedisSentinelPool("mymaster",set,"123456");
        while (true) {
            Jedis jedis=null;
            try {
                jedis = jedisSentinelPool.getResource();
                String s = UUID.randomUUID().toString();
                jedis.set("k" + s, "v" + s);
                System.out.println(jedis.get("k" + s));
                Thread.sleep(1000);
            }catch (Exception e){
                e.printStackTrace();
            }finally {
                if(jedis!=null){
                    jedis.close();
                }
            }
        }
    }
}
```

在客户端写数据过程中，使用`kill`命令杀死主机，会存在短暂的写失败情况，抛出异常。这是因为在故障迁移的时候，是不能写数据的，中间有服务不可用的过程，在迁移后会自动恢复。并且当原来的主机再启动后，会变成新主机的从机使用，这是因为哨兵会动态的修改配置文件。

## 四、哨兵模式原理

1、关于哨兵的原理，关键是了解以下核心概念：

- 主观下线：在心跳检测的定时任务中，如果其他节点超过一定时间没有回复，哨兵节点就会将其进行主观下线。顾名思义，主观下线的意思是一个哨兵节点“主观地”判断下线；与主观下线相对应的是客观下
- 客观下线：哨兵节点在对主节点进行主观下线后，会通过`sentinel is-master-down-by-addr`命令询问其他哨兵节点该主节点的状态；如果判断主节点下线的哨兵数量达到一定数值，则对该主节点进行客观下线

需要特别注意的是，客观下线是主节点才有的概念；如果从节点和哨兵节点发生故障，被哨兵主观下线后，不会再有后续的客观下线和故障转移操作。

2、每个哨兵节点维护了3个定时任务。定时任务的功能分别如下：

- 每10秒通过向主从节点发送`info`命令获取最新的主从结构：发现`slave`节点，并确定主从关系
- 每2秒通过发布订阅功能获取其他哨兵节点的信息，交互对节点的“看法”和自身情况
- 每1秒通过向其他节点发送`ping`命令进行心跳检测，判断是否下线

3、领导者选举

选举领导者哨兵节点：当主节点被判断客观下线以后，各个哨兵节点会进行协商，选举出一个领导者哨兵节点，并由该领导者节点对其进行故障转移操作。

监视该主节点的所有哨兵都有可能被选为领导者，选举使用的算法是`Raft`算法；`Raft`算法的基本思路是先到先得：即在一轮选举中，哨兵A向B发送成为领导者的申请，如果B没有同意过其他哨兵，则会同意A成为领导者。

在从节点中选择新的主节点，选择的原则如下：

- 首先过滤掉不健康的从节点
- 然后选择优先级最高的从节点（由`replica-priority`指定）
- 如果优先级无法区分，则选择复制偏移量最大的从节点
- 如果仍无法区分，则选择`runid`最小的从节点
- 更新主从状态：通过`slaveof no one`命令，让选出来的从节点成为主节点，并通过`slaveof`命令让其他节点成为其从节点
- 将已经下线的主节点保持关注，当再次上线后设置为新的主节点的从节点

## 五、总结

在实际使用过程中，哨兵节点的数量应大于一个。一方面增加哨兵节点的冗余，避免哨兵本身成为高可用的瓶颈；另一方面减少对下线的误判。此外，不同的哨兵节点应部署在不同的物理机上。并且哨兵节点的数量应该是奇数，便于哨兵通过投票进行领导者选举的决策、客观下线的决策等。

在主从复制的基础上，哨兵引入了主节点的自动故障转移，进一步提高了Redis的高可用性；但是哨兵的缺陷同样很明显：哨兵无法对从节点进行自动故障转移，在读写分离场景下，从节点故障会导致读服务不可用，需要我们对从节点做额外的监控、切换操作。此外，哨兵仍然没有解决写操作无法负载均衡、及存储能力受到单机限制的问题。