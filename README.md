# 简介
这是一个Typescript语言版的Entity-Component-System框架。框架参考了Unity的[Entitas](https://github.com/sschmid/Entitas-CSharp)框架。

# 使用说明
## 组件
组件必须继承ecs.IComponent，并且需要使用ecs.register注册组件。
```
@ecs.register('Hello')
export class HelloComponent extends ecs.IComponent {
    data: number;
}
```
ecs.register组件填入的参数是方便通过```entity.Hello```获得组件对象。ecs.register还会将组件的构造函数存入```ecs.Context```中，并且给该类组件分配一个组件id。

## 实体
为了能利用Typescript的类型提示机制，在使用实体的时候需要用户自己继承ecs.Entity。
```
class AEntity extends ecs.Entity {
    Hello: HelloComponent; // 这里的Hello要和ecs.register中填入的参数一致
}

export EntityX extends AEntity {

}
```

添加组件：
```
entity.add(HelloComponent); // 添加组件时会优先从组件缓存池中获取无用的组件对象，如果没有才会新创建一个组件对象
```

删除组件：
```
entity.remove(HelloComponent); // 组件对象会从实体身上移除并放入组件缓存池中
```

判断是否拥有组件：
```
entity.has(HelloComponent);
!!entity.Hello;
```

销毁实体：
```
entity.destroy() // 销毁实体时会先删除实体身上的所有组件，然后将实体放入实体缓存池中
```

## 实体筛选
目前提供了四种类型的筛选能力，但是这四种筛选能力可以组合从而提供更强大的筛选功能。
- anyOf: 用来描述包含任意一个这些组件的实体；
- allOf: 用来描述同时包含了这些组件的实体；
- onlyOf: 用来描述只包含了这些组件的实体；
- noneAllOf: 用来描述不同时包含这些组件的实体；

使用方式：
```
ecs.Matcher.allOf(HelloComponent);
ecs.Matcher.onlyOf(HelloComponent);
ecs.Matcher.anyOf(HelloComponent).noneAllOf(Test1Component, Test2Component);
```

## 系统
- ecs.System: 用来组合某一功能所包含的系统；
- ecs.RootSystem: 系统的root；
- ecs.ReactiveSystem: 如果捕获到组件则只会执行一次；
- ecs.ExecuteSystem: 如果捕获到组件则每帧都会执行；
- ecs.RExecuteSystem: 如果捕获到组件，能监听组件第一次进入，并且每帧都会执行；
- ecs.AutoDestroyEntityReactiveSystem：会自动销毁实体；

# Samples
https://github.com/shangdibaozi/ecs_start
