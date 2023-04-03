---
title: 浅析JDK7与JDK8中的HashMap
icon: page
order: 1
author: Hydra
date: 2020-03-31
tag:
  - 并发
  - HashMap
star: true
---



<!-- more -->

HashMap作为Java中的重要的数据结构，不仅在平常工作中被大量使用，并且在面试中也是处于必问的重要角色，今天带大家从源码角度再次重新认识一下我们常用的HashMap。

在从JDK7转化为JDK8时，`HashMap`的实现也发生了很大的改变，先来看一下它们的区别：

- JDK7 中使用**数组+链表**，JDk8 中使用**数组+链表+红黑树**实现
- 新节点在插入到链表时插入的顺序不同（JDK7插入在头节点，JDK8插入在尾节点）
- HASH算法有所简化
- 扩容机制有优化

首先看存储结构，如果大家对红黑树比较陌生，可以先自行查看完全平衡二叉树（AVL）和红黑树的相关知识，篇幅有限不再赘述。这里只列出红黑树的一些性能特点：

- 调整规则没有完全平衡二叉树严格
- 插入效率比链表低，但查询效率比链表高
- 红黑树查询效率介于链表和完全平衡二叉树之间，折中

#### JDK7

在HashMap中，我们最常用的操作大概就是`put`与`get`了，但是你真的了解他们的实现原理吗？看看put操作的核心代码：

```java
int hash=hash(key);
int i=indexFor(hash,table.length);
table[i]=newNode;
```

大体来说，包含三个操作：

1、计算传入key的`hash`值

2、通过`indexFor`方法计算下标值

3、将`newNode`加入链表，放进对应的数组下标中

注意，第三部我们直接将`newNode`赋值给`table[i]`，也就是说把节点插入在了头结点上，而将原先的链表直接连在我们新插入的节点后面。

顺带一提，HashMap中支持key为null，数组第0个位置存放`key=null`的元素，只能有一个`key=null`的元素，第0个位置不存在数组。

而`get`操作就比较简单了，先找到数组的下标，再比较key是否和给定的key相同，不同则顺着链表找下一个，直到找到或为空。具体通过`getEntry()`方法，遍历比较hash值是否相等，比较key是否相等。

```java
//key不为null,获取value
final Entry<K,V> getEntry(Object key) {
        if (size == 0) {//判断链表中是否有值
         //链表中没值,也就是没有value
            return null;
        }
       //链表中有值,获取key的hash值
        int hash = (key == null) ? 0 : hash(key);
        // 在“该hash值对应的链表”上查找“键值等于key”的元素
        for (Entry<K,V> e = table[indexFor(hash, table.length)];
             e != null;
             e = e.next) {
            Object k;
            //判断key是否相同
            if (e.hash == hash &&
                ((k = e.key) == key || (key != null && key.equals(k))))
                return e;//key相等,返回相应的value
             }
        return null;//链表中没有相应的key
}
```

既然被称为HashMap，那么计算hash值肯定是必要的一环，先看看JDK7中HashMap的`hash`方法：

```java
final int hash(Object k){
    int h= hashSeed;
    if(0 != h && k instanceof String) {
        return sun.misc.Hashing.stringHash32((String)k);
    }
    h ^= k.hashCode();
    h^= ( h>>>20) ^ (h>>>12);
    return h^ (h>>>7) ^(h>>>4);
}
```

在这当中，暂且不看hash种子，我们可以看到计算中存在大量的右移操作，那么为什么要进行右移呢，这是考虑到了碰撞性问题。之前提到使用`indexFor`来计算数组下标：

```java
static int indexFor(int h , int length){    
    return h & (length-1);
}
```

这里提一点，HashMap的长度一定是一个二的次方数，这点是在它的初始化和扩容中被限定的。这里在计算下表时，一个二的次方数减去1，能够保证它的二进制数的后几位数字全部是1，便于计算下标。

举个例子，HashMap长度为16，这样计算出的hash值与0000 1111做与运算，只需要取后四位，就实现了数组下标的计算。而与操作的计算速度比取余操作是要快上一些的。

回到上面，继续讲为什么要进行大量的右移操作，还是以长度为16来看，如果几个key计算出的hash值为：

```shell
1010 0110
0010 0110
0000 0110
```

我们发现，只要后四位一样，hash值都一样，碰撞性很高，所以这时要引入右移操作，让高位也能参与到与运算。让链表分散，减少链表长度。

#### JDK8

jdk8中引入了红黑树，但并不是说链表并不存在，查阅源码，我们可以发现两个非常关键的值：

```java
static final int TREEIFT_THRESHOLD=8;
static final int UNTREEIFT_THRESHOLD=6;
```

当链表的元素超过8时，会自动转成红黑树；当红黑树的节点数小于6时，变回链表。

看看`put`操作：

```java
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
               boolean evict) {
    Node<K,V>[] tab; Node<K,V> p; int n, i;
    if ((tab = table) == null || (n = tab.length) == 0)
        n = (tab = resize()).length;
    //当前插入的数组位置为空，可以直接插入
    if ((p = tab[i = (n - 1) & hash]) == null)
        tab[i] = newNode(hash, key, value, null);
    else {
        Node<K,V> e; K k;
        //key相等情况，e在最后处理
        if (p.hash == hash &&
            ((k = p.key) == key || (key != null && key.equals(k))))
            e = p;
        //判断是红黑树的树节点
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        //是链表结构 
       else {
            for (int binCount = 0; ; ++binCount) { //binCount是遍历链表过程中计数
                //遍历链表，循环到尾结点，把新元素加在尾部，break
                if ((e = p.next) == null) {
                    p.next = newNode(hash, key, value, null);
                    //判断是否大于变成树的阈值-1,7会变成8，变成红黑树
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    break;
                }
                //找到相等元素也break
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    break;
                p = e;
            }
        }
        //重复key
        if (e != null) { // existing mapping for key
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null)
                e.value = value;
            afterNodeAccess(e);
            return oldValue;
        }
    }
    ++modCount;
    //扩容
    if (++size > threshold)
        resize();
    afterNodeInsertion(evict);
    return null;
}
```

看完这段代码，我们就明白了为什么jdk8中使用的是尾插法。因为在判断是使用链表或红黑树的过程中，要判断是否超过8个元素，至少需要遍历一遍，所以使用尾插法，新元素可以直接插入在尾结点。

`get`方法大体思路不变，计算下标，然后遍历，只不过是比jdk7中多加上一个判断是试用链表存储还是红黑树存储的步骤。

而jdk8也精简了它的`hash`算法：

```java
static final int hash(Object key) {
    int h;
    return (key == null) ? 0 : (h = key.hashCode()) ^ (h >>> 16);
}
```

只右移16位，精简了hash算法，配合红黑树提高查询效率。

最后看一下两者的扩容操作，扩容是对数组进行扩容，而不是链表或红黑树。我们在初始化时数组的默认长度是16，前面提到当存储的元素很多时会发生hash碰撞。我们扩容的目的是将长链表的长度减短，提高查询效率。

由于扩容的源码比较长，就不贴在这里，只列出核心思想。

**jdk7中：**

只有当数量大于阈值，且当前插入位置不为空时才会进行扩容，并且容量为原先2倍。

在将老的table转移到新的table时，需要重新计算数组的下标。

扩容后，重新计算下标。以从16位扩容到32位为例：

```shell
h      1010 0110
31     0001 1111
结果    0000 0110    （与之前相同）
```

```shell
h     1011 0110
31    0001 1111
结果  0001 0110    （与之前不同，相当于比之前加了16）
```

扩容后，数组下标可能改变，也可能不变。这时要看扩容的那一位的哈希值是1还是0，如果是1则不同，0则相同。但是在这个过程中，有可能造成死锁问题。

**jdk8中：**

JDK8扩容中，为了避免之前提到的死锁问题，改进了扩容方法。通过判断这1位是0还是1，是0则不变。如果是1 ，加上原先数组大小。

```java
newTab[j + oldCap] = hiHead;
//oldCap是原先的数组长度
```

总结：

- 扩容这一操作非常耗时，默认达到75%按照2倍进行扩容，这个75%也就是factor扩容因子。
- JDK7中扩容是在节点还没有加到HashMap前发生的；JDK8中扩容是在节点加到HashMap后发生的。
- JDK7扩容是一个一个元素计算然后转移，JDK8是先遍历，判断哪些是放到新数组的低位，哪些是高位，然后将low的元素和high的元素分别组合起来，一次性转移到新的数组中。