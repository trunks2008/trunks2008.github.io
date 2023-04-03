---
title: 眼见为实，看看MySQL中的隐藏列！
icon: page
order: 3
author: Hydra
date: 2021-09-01
tag:
  - MySql
star: true
---



<!-- more -->

在介绍mysql的多版本并发控制`mvcc`的过程中，我们提到过mysql中存在一些隐藏列，例如**行标识**、**事务ID**、**回滚指针**等，不知道大家是否和我一样好奇过，要怎样才能实际地看到这些隐藏列的值呢？

本文我们就来重点讨论一下诸多隐藏列中的行标识`DB_ROW_ID`，实际上，将行标识称为隐藏**列**并不准确，因为它并不是一个真实存在的列，`DB_ROW_ID`实际上是一个非空唯一列的**别名**。在拨开它的神秘面纱之前，我们看一下官方文档的说明：

> If a table has a `PRIMARY KEY` or `UNIQUE NOT NULL` index that consists of a single column that has an integer type, you can use `_rowid` to refer to the indexed column in `SELECT` statements

简单翻译一下，如果在表中存在主键或非空唯一索引，并且仅由一个整数类型的列构成，那么就可以使用`SELECT`语句直接查询`_rowid`，并且这个`_rowid`的值会引用该索引列的值。

着重看一下文档中提到的几个关键字，**主键**、**唯一索引**、**非空**、**单独一列**、**数值类型**，接下来我们就要从这些角度入手，探究一下神秘的隐藏字段`_rowid`。

#### 1、存在主键

先看设置了主键且是数值类型的情况，使用下面的语句建表：

```sql
CREATE TABLE `table1` (
  `id` bigint(20) NOT NULL PRIMARY KEY ,
  `name` varchar(32) DEFAULT NULL
) ENGINE=InnoDB;
```

插入三条测试数据后，执行下面的查询语句，在`select`查询语句中直接查询`_rowid`：

```sql
select *,_rowid from table1
```

查看执行结果，`_rowid`可以被正常查询：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/dc1d3f07030a4242ab3325d68e44a0b3~tplv-k3u1fbpfcp-zoom-1.image)

可以看到在设置了主键，并且主键字段是数值类型的情况下，`_rowid`直接引用了主键字段的值。对于这种可以被`select`语句查询到的的情况，可以将其称为**显式**的`rowid`。

回顾一下前面提到的文档中的几个关键字，分别对其进行分析。由于主键必定是非空字段，下面来看一下主键是非数值类型字段的情况，建表如下：

```sql
CREATE TABLE `table2` (
  `id` varchar(20) NOT NULL PRIMARY KEY ,
  `name` varchar(32) DEFAULT NULL
) ENGINE=InnoDB;
```

在`table2`执行上面相同的查询，结果报错无法查询`_rowid`，也就证明了如果主键字段是非数值类型，那么将无法直接查询`_rowid`。

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5221fec03a2c436a81b1b09bbe8615ef~tplv-k3u1fbpfcp-zoom-1.image)

#### 2、无主键，存在唯一索引

上面对两种类型的主键进行了测试后，接下来我们看一下当表中没有主键、但存在唯一索引的情况。首先测试非空唯一索引加在数值类型字段的情况，建表如下：

```sql
CREATE TABLE `table3` (
  `id` bigint(20) NOT NULL UNIQUE KEY,
  `name` varchar(32)
) ENGINE=InnoDB;
```

查询可以正常执行，并且`_rowid`引用了唯一索引所在列的值：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/fca27934864e4beba90ad07e865b8248~tplv-k3u1fbpfcp-zoom-1.image)

唯一索引与主键不同的是，唯一索引所在的字段可以为`NULL`。在上面的`table3`中，在唯一索引所在的列上添加了`NOT NULL`非空约束，如果我们把这个非空约束删除掉，还能显式地查询到`_rowid`吗？下面再创建一个表，不同是在唯一索引所在的列上，不添加非空约束：

```sql
CREATE TABLE `table4` (
  `id` bigint(20) UNIQUE KEY,
  `name` varchar(32)
) ENGINE=InnoDB;
```

执行查询语句，在这种情况下，无法显式地查询到`_rowid`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/4b45da4f79b84e4fbc66bd2c81acebe0~tplv-k3u1fbpfcp-zoom-1.image)

和主键类似的，我们再对唯一索引被加在非数值类型的字段的情况进行测试。下面在建表时将唯一索引添加在字符类型的字段上，并添加非空约束：

```sql
CREATE TABLE `table5` (
  `id` bigint(20),
  `name` varchar(32) NOT NULL UNIQUE KEY
) ENGINE=InnoDB;
```

同样无法显示的查询到`_rowid`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/bfd878f2d2e94b9ca4a1ee1f74a42051~tplv-k3u1fbpfcp-zoom-1.image)

针对上面三种情况的测试结果，可以得出结论，当没有主键、但存在唯一索引的情况下，只有该唯一索引被添加在数值类型的字段上，且该字段添加了非空约束时，才能够显式地查询到`_rowid`，并且`_rowid`引用了这个唯一索引字段的值。

#### 3、存在联合主键或联合唯一索引

在上面的测试中，我们都是将主键或唯一索引作用在单独的一列上，那么如果使用了联合主键或联合唯一索引时，结果会如何呢？还是先看一下官方文档中的说明：

> `_rowid` refers to the `PRIMARY KEY` column if there is a `PRIMARY KEY` consisting of a single integer column. If there is a `PRIMARY KEY` but it does not consist of a single integer column, `_rowid` cannot be used.

简单来说就是，如果主键存在、且仅由数值类型的一列构成，那么`_rowid`的值会引用主键。如果主键是由多列构成，那么`_rowid`将不可用。

根据这一描述，我们测试一下联合主键的情况，下面将两列数值类型字段作为联合主键建表：

```sql
CREATE TABLE `table6` (
  `id` bigint(20) NOT NULL,
  `no` bigint(20) NOT NULL,
  `name` varchar(32),
  PRIMARY KEY(`id`,`no`)
) ENGINE=InnoDB;
```

执行结果无法显示的查询到`_rowid`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/c662c39d433d4a8dab6459bc6f6854b3~tplv-k3u1fbpfcp-zoom-1.image)

同样，这一理论也可以作用于唯一索引，如果非空唯一索引不是由单独一列构成，那么也无法直接查询得到`_rowid`。这一测试过程省略，有兴趣的小伙伴可以自己动手试试。

#### 4、存在多个唯一索引

在mysql中，每张表只能存在一个主键，但是可以存在多个唯一索引。那么如果同时存在多个符合规则的唯一索引，会引用哪个作为`_rowid`的值呢？老规矩，还是看官方文档的解答：

> Otherwise, `_rowid` refers to the column in the first `UNIQUE NOT NULL` index if that index consists of a single integer column. If the first `UNIQUE NOT NULL` index does not consist of a single integer column, `_rowid` cannot be used.

简单翻译一下，如果表中的第一个非空唯一索引仅由一个整数类型字段构成，那么`_rowid`会引用这个字段的值。否则，如果第一个非空唯一索引不满足这种情况，那么`_rowid`将不可用。

在下面的表中，创建两个都符合规则的唯一索引：

```sql
CREATE TABLE `table8_2` (
  `id` bigint(20) NOT NULL,
  `no` bigint(20) NOT NULL,
  `name` varchar(32),
  UNIQUE KEY(no),
  UNIQUE KEY(id)
) ENGINE=InnoDB;
```

看一下执行查询语句的结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/5fc4819649804590be98ce48e77f43b0~tplv-k3u1fbpfcp-zoom-1.image)

可以看到`_rowid`的值与`no`这一列的值相同，证明了`_rowid`会严格地选取第一个创建的唯一索引作为它的引用。

那么，如果表中创建的第一个唯一索引不符合`_rowid`的引用规则，第二个唯一索引满足规则，这种情况下，`_rowid`可以被显示地查询吗？针对这种情况我们建表如下，表中的第一个索引是联合唯一索引，第二个索引才是单列的唯一索引情况，再来进行一下测试：

```sql
CREATE TABLE `table9` (
  `id` bigint(20) NOT NULL,
  `no` bigint(20) NOT NULL,
  `name` varchar(32),
  UNIQUE KEY `index1`(`id`,`no`),
  UNIQUE KEY `index2`(`id`)
) ENGINE=InnoDB;
```

进行查询，可以看到虽然存在一个单列的非空唯一索引，但是因为顺序选取的第一个不满足要求，因此仍然不能直接查询`_rowid`：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/8b67d8259cf148ce951f4c4ca1de3a19~tplv-k3u1fbpfcp-zoom-1.image)

如果将上面创建唯一索引的语句顺序调换，那么将可以正常显式的查询到`_rowid`。

#### 5、同时存在主键与唯一索引

从上面的例子中，可以看到唯一索引的**定义顺序**会决定将哪一个索引应用`_rowid`，那么当同时存在主键和唯一索引时，定义顺序会对其引用造成影响吗？

按照下面的语句创建两个表，只有创建主键和唯一索引的顺序不同：

```sql
CREATE TABLE `table11` (
  `id` bigint(20) NOT NULL,
  `no` bigint(20) NOT NULL,
  PRIMARY KEY(id),
  UNIQUE KEY(no)
) ENGINE=InnoDB;

CREATE TABLE `table12` (
  `id` bigint(20) NOT NULL,
  `no` bigint(20) NOT NULL,
  UNIQUE KEY(id),
  PRIMARY KEY(no)
) ENGINE=InnoDB;
```

查看运行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/19ada78555f34f81a56627e3381d00a5~tplv-k3u1fbpfcp-zoom-1.image)

可以得出结论，当同时存在符合条件的主键和唯一索引时，无论创建顺序如何，`_rowid`都会优先引用主键字段的值。

#### 6、无符合条件的主键与唯一索引

上面，我们把能够直接通过`select`语句查询到的称为显式的`_rowid`，在其他情况下虽然`_rowid`不能被显式查询，但是它也是一直存在的，这种情况我们可以将其称为隐式的`_rowid`。

实际上，`innoDB`在没有默认主键的情况下会生成一个6字节长度的无符号数作为自动增长的`_rowid`，因此最大为`2^48-1`，到达最大值后会从0开始计算。下面，我们创建一个没有主键与唯一索引的表，在这张表的基础上，探究一下隐式的`_rowid`。

```sql
CREATE TABLE `table10` (
  `id` bigint(20),
  `name` varchar(32)
) ENGINE=InnoDB;
```

首先，我们需要先查找到mysql的进程`pid`：

```shell
ps -ef | grep mysqld
```

可以看到，mysql的进程`pid`是2068：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ef2083d895a0410f9b83c159a1717622~tplv-k3u1fbpfcp-zoom-1.image)

在开始动手前，还需要做一点铺垫， 在`innoDB`中其实维护了一个全局变量`dictsys.row_id`，没有定义主键的表都会共享使用这个`row_id`，在插入数据时会把这个全局`row_id`当作自己的主键，然后再将这个全局变量加 1。

接下来我们需要用到`gdb`调试的相关技术，`gdb`是一个在Linux下的调试工具，可以用来调试可执行文件。在服务器上，先通过`yum install gdb`安装，安装完成后，通过下面的`gdb`命令 把 `row_id` 修改为 1：

```shell
gdb -p 2068 -ex 'p dict_sys->row_id=1' -batch
```

命令执行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/85122dd6c308488fb1a312d4a7df7e26~tplv-k3u1fbpfcp-zoom-1.image)

在空表中插入3行数据：

```sql
INSERT INTO table10 VALUES (100000001, 'Hydra');
INSERT INTO table10 VALUES (100000002, 'Trunks');
INSERT INTO table10 VALUES (100000003, 'Susan');
```

查看表中的数据，此时对应的`_rowid`理论上是1~3：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/ea89d5deb7244832930b3dacf825a4e4~tplv-k3u1fbpfcp-zoom-1.image)

然后通过`gdb`命令把`row_id`改为最大值`2^48`，此时已超过`dictsys.row_id`最大值：

```shell
gdb -p 2068 -ex 'p dict_sys->row_id=281474976710656' -batch
```

命令执行结果：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/71ad53e117ed4202acbeb8a8b8efd52e~tplv-k3u1fbpfcp-zoom-1.image)

再向表中插入三条数据：

```sql
INSERT INTO table10 VALUES (100000004, 'King');
INSERT INTO table10 VALUES (100000005, 'Queen');
INSERT INTO table10 VALUES (100000006, 'Jack');
```

查看表中的全部数据，可以看到第一次插入的三条数据中，有两条数据被覆盖了：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/eb06572df7044a188fad067424aeef95~tplv-k3u1fbpfcp-zoom-1.image)

为什么会出现数据覆盖的情况呢，我们对这一结果进行分析。首先，在第一次插入数据前`_rowid`为1，插入的三条数据对应的`_rowid`为1、2、3。如下图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/16d55e16ff2a432db8ee50191056bdaf~tplv-k3u1fbpfcp-zoom-1.image)

当手动设置`_rowid`为最大值后，下一次插入数据时，插入的`_rowid`重新从0开始，因此第二次插入的三条数据的`_rowid`应该为0、1、2。这时准备被插入的数据如下所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/e1d423633ea2459495593601ba600b2c~tplv-k3u1fbpfcp-zoom-1.image)

当出现相同`_rowid`的情况下，新插入的数据会根据`_rowid`覆盖掉原有的数据，过程如图所示：

![](https://p3-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/f45cb693678f4e51b7d3efa33131e48a~tplv-k3u1fbpfcp-zoom-1.image)

所以当表中的主键或唯一索引不满足我们前面提到的要求时，`innoDB`使用的隐式的`_rowid`是存在一定风险的，虽然说`2^48`这个值很大，但还是有可能被用尽的，当`_rowid`用尽后，之前的记录就会被覆盖。从这一角度也可以提醒大家，在建表时一定要创建主键，否则就有可能发生数据的覆盖。

> 本文基于mysql 5.7.31 进行测试
>
> 官方文档：https://dev.mysql.com/doc/refman/5.7/en/create-index.html
>