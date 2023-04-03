---
title: Zookeeper实现分布式锁
icon: page
order: 10
author: Hydra
date: 2020-08-23
tag:
  - Zookeeper
  - 分布式锁
star: true
---



<!-- more -->

在之前的文章中，我们介绍了[使用Redis实现分布式锁](https://juejin.cn/post/7021424431679406087)，这篇文章中，我们通过模拟一个实例来看一下分布式锁的另外一种实现方式，使用Zookeeper实现分布式锁。

使用zk实现分布式锁，主要还是依赖于它的两个特性：

**节点类型：**

zk节点根据是否持久、是否有序将节点分为了4类：

- 持久节点：客户端与zk断开后，节点不会自动删除，需要手动删除
- 持久顺序节点：在持久节点的基础上，对节点名称进行了顺序编号
- 临时节点：客户端与zk断开连接后，节点会自动删除
- 临时顺序节点：在临时节点的基础上，对节点名称进行了顺序编号

**监听机制：**

客户端注册监听它关心的节点，当节点上发生事件变化时，zk会通知客户端。主要事件包括：

- `NodeCreated`：节点被创建时，该事件被触发
- `NodeChildrenChanged`：子节点被创建、被删除、子节点数据发生变更时，该事件被触发
- `NodeDataChanged`：节点的数据发生变更时，该事件被触发
- `NodeDeleted`：节点被删除时，该事件被触发
- `None`：当zk客户端的连接状态发生变更时，该事件被触发

## 核心思想

介绍完这两点特性，我们再看一下使用zk实现分布式锁要注意的几点：

1. 实现目的：在多线程竞争锁时，只能有一个线程能够获得分布式锁
2. 实现思路：使用顺序节点实现，只有兄弟节点中序号值为最小值的节点能够获得分布式锁
3. 释放锁：释放锁通过删除节点实现，为了避免节点线程宕机而没有释放分布式锁的情况，可以使用临时节点自动释放分布式锁
4. 监听：每个节点监听它的前一个顺序节点的删除事件，当监听到删除事件后，判断自己是不是最小序号的节点，如果是则获得分布式锁

## 代码实现

我们以电商平台一次购买流程为例，在进行一次下单的过程中，首先需要创建订单、然后查询库存，最终完成支付操作。三个过程有明显的先后流程关系，并且减库存必须要保证原子操作。

创建订单：

```java
public class Order {
    public void createOrder(){
        System.out.println(Thread.currentThread().getName()+"创建订单");
    }
}
```

减少库存，这里设置库存数量为1。如果只有一个线程能够执行减库存成功，那么证明分布式锁实现成功：

```java
public class Stock {
    private static Integer COUNT=1;
    public boolean reduceStock() {
        if (COUNT>0){
            COUNT--;
            return true;
        }
        return false;
    }
}
```

用户支付：

```java
public class Pay {
    public void pay(){
        System.out.println(Thread.currentThread().getName()+"支付成功");
    }
}
```

使用zk实现分布式锁：

1. 实现`Lock`接口，重写`lock()`方法，`tryLock()`方法，`unLock()`核心方法，作为分布式锁的加锁、解锁方法
2. 使用`apache.ZooKeeper`原生客户端api操作Zookeeper
3. 在zk的`/LOCK`节点下创建`zk_`开头的临时顺序节点，通过节点序号大小判断自己能否获得锁
4. 使用`ThreadLocal`存储节点的名称，保证线程安全。其中存储了节点自己的名字，作为判断自己是否最小节点的依据
5. 如果没有获取到锁，则使用`Watcher`监控自己的前一个节点。因为`Watcher`是异步操作，使用`CountDownLatch`进行阻塞，当前一个节点被删除时才被唤醒

具体实现：

```java
public class ZkLock implements Lock {
    private ThreadLocal<ZooKeeper> zk=new ThreadLocal<>();
    private String LOCK_NAME="/LOCK";
    private ThreadLocal<String> CURRENT_NODE=new ThreadLocal<>();

    public void init(){
        if (zk.get()==null){
            try {
                zk.set(new ZooKeeper("localhost:2181", 300, new Watcher() {
                    @Override
                    public void process(WatchedEvent event) {
                        System.out.println("watch event");
                    }
                }));
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    public void lock(){
        init();
        if(tryLock()){
            System.out.println(Thread.currentThread().getName()+"已经获取到锁了");
        }
    }

    public boolean tryLock(){
        String nodeName=LOCK_NAME+"/zk_";
        try {
            CURRENT_NODE.set( zk.get().create(nodeName, new byte[0], ZooDefs.Ids.OPEN_ACL_UNSAFE, CreateMode.EPHEMERAL_SEQUENTIAL));
            List<String> list = zk.get().getChildren(LOCK_NAME, false);
            Collections.sort(list);
            String minNodeName = list.get(0);

            if (CURRENT_NODE.get().equals(LOCK_NAME+"/"+minNodeName)){
                return true;
            }else{
                //监听前一个节点
                String currentNodeSimpleName=CURRENT_NODE.get().substring(CURRENT_NODE.get().lastIndexOf("/") + 1);
                int  currentNodeIndex= list.indexOf(currentNodeSimpleName);
                String preNodeSimpleName = list.get(currentNodeIndex - 1);
                System.out.println(Thread.currentThread().getName()+"-监听节点："+preNodeSimpleName);
        
                CountDownLatch countDownLatch=new CountDownLatch(1);
                zk.get().exists(LOCK_NAME + "/" + preNodeSimpleName, new Watcher() {
                    @Override
                    public void process(WatchedEvent event) {
                        if (Event.EventType.NodeDeleted.equals(event.getType())){
                            countDownLatch.countDown();
                            System.out.println(Thread.currentThread().getName()+"被唤醒");
                        }
                    }
                });
                System.out.println(Thread.currentThread().getName()+"阻塞住");
                countDownLatch.await();
                return true;
            }
        } catch (KeeperException e) {
            e.printStackTrace();
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return false;
    }

    public void unlock(){
        try {
            //-1表示忽略版本号，强制删除
            zk.get().delete(CURRENT_NODE.get(),-1);
            System.out.println(Thread.currentThread().getName()+"-删除节点");
            CURRENT_NODE.set(null);
            zk.get().close();
        } catch (InterruptedException e) {
            e.printStackTrace();
        } catch (KeeperException e) {
            e.printStackTrace();
        }
    }

    @Override
    public boolean tryLock(long time, TimeUnit unit) throws InterruptedException {
        return false;
    }
    @Override
    public void lockInterruptibly() throws InterruptedException {
    }
    @Override
    public Condition newCondition() {
        return null;
    }
}
```

主程序，使用两个线程竞争分布式锁：

```java
public class Main {
    public static void main(String[] args) {
        Thread user1 = new Thread(new UserThread(), "user1");
        Thread user2 = new Thread(new UserThread(), "user2");
        user1.start();
        user2.start();
    }
    static Lock lock=new ZkLock();
    static class UserThread implements Runnable{
        @Override
        public void run() {
            new  Order().createOrder();
            lock.lock();
            boolean result = new Stock().reduceStock();
            lock.unlock();
            if (result){
                System.out.println(Thread.currentThread().getName()+"减库存成功");
                new Pay().pay();
            }else {
                System.out.println(Thread.currentThread().getName()+"减库存失败");
            }
        }
    }
}
```

查看运行结果：

![图片](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/14d95f510e76402683a736aa9a09f181~tplv-k3u1fbpfcp-zoom-1.image)

可以看到，在两个用户完成创建订单操作后，只有一个线程能够减少库存成功。实际执行中，user2获取到分布式锁并减库存成功，而user1被阻塞，无法完成后续操作。