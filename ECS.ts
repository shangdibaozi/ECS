export module ecs {
    
    type ComponentConstructor<T> = {
        tid: number;
        compName : string;
        new() : T;
    }
    /**
     * 组件可能是从组件缓存池中取出来的，这个时候组件中的数据是销毁前的数据，这可能会导致逻辑行为的不确定。
     * 所以在得到组件后要注意某些数据的初始化工作。
     */
    export abstract class IComponent {
        /**
         * 每类组件的唯一id
         */
        static tid: number = -1;
        /**
         * 组件名称。用作实体对象属性的key。
         */
        static compName: string = null;
    }
    //----------------------------------------------------------------------------------------------------
    export interface ISystem {

    }

    //----------------------------------------------------------------------------------------------------
    export interface IExecuteSystem extends ISystem {
        readonly group: Group<Entity>;
        init(): void;
        execute(dt: number): void;
    }
    //----------------------------------------------------------------------------------------------------
    export interface IReactiveSystem extends IExecuteSystem {

    }
    //----------------------------------------------------------------------------------------------------
    export interface IRExecuteSystem extends IExecuteSystem {
        readonly group: Group<Entity>;
        readonly rGroup: Group<Entity>;

        init(): void;
        execute(dt: number): void;
    }
    //----------------------------------------------------------------------------------------------------

    /**
     * 注册组件工具
     */
    /**
     * 组件类型id
     */
    let compTid = 0;
    /**
     * 组件构造函数
     */
    let componentConstructors: ComponentConstructor<IComponent>[] = [];
    /**
     * 由于js打包会改变类名，所以这里必须手动传入组件的名称。
     * @param componentName 
     */
    export function register(componentName: string) {
        return function (ctor: ComponentConstructor<IComponent>) {
            if (ctor.tid === -1) {
                ctor.tid = compTid++;
                ctor.compName = componentName;
                componentConstructors.push(ctor);
            }
            else {
                throw new Error('already contain component ' + componentName);
            }
        }
    }

    export function getComponentConstructors() {
        return componentConstructors;
    }
    //----------------------------------------------------------------------------------------------------
    type ComponentAddOrRemove = (entity: Entity) => void;

    export class Context<E extends Entity> {

        /**
         * 组件缓存池
         */
        private componentPools: Array<Array<IComponent>> = null;
        /**
         * 实体对象缓存池
         */
        private entityPool: E[] = [];

        /**
         * 通过实体id查找实体对象
         */
        private eid2Entity: Map<number, E> = new Map();

        /**
         * 当前Context下组件类型数量
         */
        public readonly totalComponents: number = 0;
        /**
         * 每个类型组件对应的构造函数
         */
        public readonly componentTypes: ComponentConstructor<IComponent>[];

        /**
         * 每个组件的添加和删除的动作都要派送到“关心”它们的group上。
         */
        private readonly componentAddOrRemove: Array<Array<ComponentAddOrRemove>> = null;

        private groups: Map<string, Group<E>> = new Map();

        private entityConstructor: { new(context: Context<E>): E } = null;

        constructor(eCtor: { new(context: Context<E>): E }, componentConstructors: ComponentConstructor<IComponent>[]) {
            this.entityConstructor = eCtor;
            this.totalComponents = componentConstructors.length;
            this.componentTypes = componentConstructors;

            this.componentPools = new Array<Array<IComponent>>(this.totalComponents);
            this.componentAddOrRemove = new Array<Array<ComponentAddOrRemove>>(this.totalComponents);

            for (let i = 0; i < this.totalComponents; i++) {
                this.componentPools[i] = [];
                this.componentAddOrRemove[i] = [];
            }
            if (this.totalComponents > 64) {
                throw new Error('最多支持64种组件！');
            }
        }

        /**
         * 为了管理到每一个创建的Entity，需要通过Context去创建。
         */
        createEntity(): E {
            let entity = this.entityPool.pop() || new this.entityConstructor(this);
            entity.init(this);
            this.eid2Entity.set(entity.eid, entity);
            return entity as E;
        }

        /**
         * 销毁实体。
         * 
         * Context会缓存销毁的实体，下次新建实体时会优先从缓存中拿。
         * @param entity 
         */
        destroyEntity(entity: E) {
            if (this.eid2Entity.has(entity.eid)) {
                entity.destroy();
                this.entityPool.push(entity);
                this.eid2Entity.delete(entity.eid);
            }
            else {
                console.warn('Context.destroyEntity. Entity already destroyed.', entity.eid);
            }
        }

        /**
         * 创建group，每个group只关心对应组件的添加和删除
         * @param matchCompTypeIds 
         * @param systemType e-表示ExecuteSystem，r-表示ReactiveSystem，c-表示在系统中自己手动调用createGroup创建的筛选规则
         */
        createGroup(matcher: Matcher, systemType: string = 'c'): Group<E> {
            let key = `${systemType}_${matcher.getKey()}`;
            let group = this.groups.get(key);
            if (!group) {
                group = new Group(matcher);
                this.groups.set(key, group);
                let careComponentTypeIds = matcher.indices;
                for (let i = 0, len = careComponentTypeIds.length; i < len; i++) {
                    this.componentAddOrRemove[careComponentTypeIds[i]].push(group.onComponentAddOrRemove.bind(group));
                }
            }
            return group;
        }

        clear() {
            this.groups.forEach((group) => {
                group.clearCollectedEntities();
            });
            this.recycleEntities();
        }

        /**
         * 回收所有实体
         */
        recycleEntities() {
            this.eid2Entity.forEach((item) => {
                this.destroyEntity(item);
            });
        }

        createComponent<T extends IComponent>(ctor: ComponentConstructor<T>): T {
            let component = this.componentPools[ctor.tid].pop() || new this.componentTypes[ctor.tid];
            return component as T;
        }

        putComponent(componentTypeId: number, component: IComponent) {
            this.componentPools[componentTypeId].push(component);
        }

        /**
         * 实体身上组件有增删操作，广播通知对应的观察者。
         * @param entity 实体对象
         * @param componentTypeId 组件类型id
         */
        broadcastComponentAddOrRemove(entity: Entity, componentTypeId: number) {
            let events = this.componentAddOrRemove[componentTypeId];
            for (let i = events.length - 1; i >= 0; i--) {
                events[i](entity);
            }
        }

        getEntityByEid(eid: number): E {
            return this.eid2Entity.get(eid);
        }
    }
    //----------------------------------------------------------------------------------------------------

    export class Entity {
        /**
         * 实体id自增量
         */
        private static eid: number = 1;
        /**
         * 实体唯一标识
         */
        public readonly eid: number = -1;

        /**
         * 用来标识组件是否存在。
         * 
         * 在JavaScript中1左移最多30位，超过30位就溢出了。实际工程中组件的个数可能大于30个，所以用了数组，这样能描述更高位的数据。
         * 
         * Math.floor(组件类型id/30) -> 得到的是数组的索引，表示这个组件的位数据在这个索引下的数值里面
         * 
         * (1 << 组件类型id%30) -> 得到的是这个组件的“位”
         */
        private _componentFlag: Uint32Array = new Uint32Array([0, 0]);
        get componentFlag() {
            return this._componentFlag;
        }

        /**
         * 当前实体身上附加的组件构造函数
         */
        private compTid2Ctor: Map<number, ComponentConstructor<IComponent>> = new Map();

        public context: Context<Entity>;

        constructor() {
            this.eid = Entity.eid++;
        }

        init(context: Context<Entity>) {
            this.context = context;
        }

        /**
         * 根据组件id动态创建组件，并通知关心的系统。
         * 
         * 如果实体存在了这个组件，那么会先删除之前的组件然后添加新的。
         * 
         * 注意：不要直接new Component，new来的Component不会从Component的缓存池拿缓存的数据。
         * @param componentTypeId 组件id
         */
        addComponent<T extends IComponent>(ctor: ComponentConstructor<T>): T {
            if (!this.context) {
                console.warn('entity already destroyed.', this.eid);
                return;
            }

            let componentTypeId = ctor.tid;
            let idx = (componentTypeId / 30) >>> 0;
            let offset = componentTypeId % 30;
            if (!!(this._componentFlag[idx] & (1 << offset))) { // 判断是否有该组件，如果有则先移除
                this.removeComponent(ctor);
            }
            
            this._componentFlag[idx] |= 1 << offset;

            // 创建组件对象
            let component = this.context.createComponent(ctor);
            // 将组件对象直接附加到实体对象身上，方便直接获取。
            this[ctor.compName] = component;

            this.compTid2Ctor.set(componentTypeId, ctor);
            // 广播实体添加组件的消息
            this.context.broadcastComponentAddOrRemove(this, componentTypeId);
            return component;
        }

        getComponent<T extends IComponent>(ctor: ComponentConstructor<T>): T {
            return this[ctor.compName];
        }

        hasComponent<T extends IComponent>(ctor: ComponentConstructor<T>): boolean {
            let idx = (ctor.tid / 30) >>> 0;
            let offset = ctor.tid % 30;
            return !!(this._componentFlag[idx] & (1 << offset));
        }

        removeComponent<T extends IComponent>(ctor: ComponentConstructor<T>) {
            let componentTypeId = ctor.tid;
            let idx = (componentTypeId / 30) >>> 0;
            let offset = componentTypeId % 30;
            if (!!(this._componentFlag[idx] & (1 << offset))) {
                this.context.putComponent(componentTypeId, this[ctor.compName]);
                this[ctor.compName] = null;
                
                this._componentFlag[idx] &= ~(1 << offset);
                this.context.broadcastComponentAddOrRemove(this, componentTypeId);

                this.compTid2Ctor.delete(componentTypeId);
            }
        }

        /**
         * 销毁实体，这个过程会回收实体身上的所有组件。不建议在单个系统中调用这个方法销毁实体。可能会导致System的for循环遍历出现问题。
         * 最好在同一个销毁实体系统中调用这个方法。
         * 
         * 使用context.destroyEntity来回收实体，这样实体可以重复使用
         */
        destroy() {
            let ctor: ComponentConstructor<IComponent>;
            let idx = 0;
            let offset = 0;
            
            for(let ctidS in this.compTid2Ctor) {
                ctor = this.compTid2Ctor[ctidS];
                idx = (ctor.tid / 30) >>> 0;
                offset = ctor.tid % 30;
                this._componentFlag[idx] &= ~(1 << offset);
                this.context.broadcastComponentAddOrRemove(this, ctor.tid);
                this[ctor.compName] = null;
            }
            this.compTid2Ctor.clear();
            this._componentFlag[0] = 0;
            this._componentFlag[1] = 0;
            this.context = null;
        }
    }
    //----------------------------------------------------------------------------------------------------

    export class Group<E extends Entity> {
        /**
         * 实体筛选规则
         */
        private matcher: Matcher;

        /**
         * 所有满足的实体，这个数组可能随时添加或移除实体。
         */
        private _matchEntities: E[] = [];
        get matchEntities() {
            return this._matchEntities;
        }

        private eid2idx: Map<number, number> = new Map();

        /**
         * 当前group中实体的数量
         */
        get count() {
            return this.eid2idx.size;
        }

        /**
         * 获取matchEntities中第一个实体
         */
        get entity(): E {
            return this.matchEntities[0];
        }

        constructor(matcher: Matcher) {
            this.matcher = matcher;
        }

        /**
         * 实体添加或删除组件回调
         * @param entity 实体对象
         */
        onComponentAddOrRemove(entity: E) {
            if (this.matcher.isMatch(entity)) { // 判断实体对象是否符合Group的筛选规则，即实体身上是否有Group关注的那几个组件
                this.addEntity(entity);
            }
            else if(this.eid2idx.has(entity.eid)) { // 如果Group中有这个实体，但是这个实体已经不满足匹配规则，则从Group中移除该实体
                this.removeEntity(entity);
            }
        }

        /**
         * 实体身上每种类型的组件只能挂载1个，所以能保证实体被添加进group之后不会再被添加一遍，就不用判断实体是否已存在于matchEntities中。
         * @param entity 
         */
        addEntity(entity: E) {
            this._matchEntities.push(entity);
            this.eid2idx.set(entity.eid, this.eid2idx.size);
        }

        removeEntity(entity: E) {
            let idx = this.eid2idx.get(entity.eid);
            // 将最后一个实体的索引交换到要删除实体的位置
            this._matchEntities[idx] = this._matchEntities[this.count - 1];
            // 更新被交换实体对应的索引
            this.eid2idx.set(this._matchEntities[idx].eid, idx);
            this.eid2idx.delete(entity.eid);
            this._matchEntities.length--;
        }

        clearCollectedEntities() {
            this._matchEntities.length = 0;
            this.eid2idx.clear();
        }
    }

    abstract class BaseOf {
        protected componentFlag: Uint32Array = new Uint32Array([0, 0]); // 最多支持64个组件
        public indices: number[] = [];
        constructor(...args: number[]) {
            let componentTypeId = -1;
            for (let i = 0, len = args.length; i < len; i++) {
                componentTypeId = args[i];
                if(componentTypeId == -1) {
                    throw Error('存在没有注册的组件！');
                }
                let idx = (componentTypeId / 30) >>> 0;
                let offset = componentTypeId % 30;
                this.componentFlag[idx] |= 1 << offset;

                if (this.indices.indexOf(args[i]) < 0) { // 去重
                    this.indices.push(args[i]);
                }
            }
            this.indices.sort((a, b) => { return a - b; }); // 对组件类型id进行排序，这样关注相同组件的系统就能共用同一个group
        }

        public toString(): string {
            return this.indices.join('-'); // 生成group的key
        }

        public abstract getKey(): string;

        public abstract isMatch(entity: Entity): boolean;
    }

    /**
     * 用于描述包含任意一个这些组件的实体
     */
    class AnyOf extends BaseOf {
        public isMatch(entity: Entity): boolean {
            return !!(entity.componentFlag[0] & this.componentFlag[0]) || !!(entity.componentFlag[1] & this.componentFlag[1]);
        }

        getKey(): string {
            return 'anyOf:' + this.toString();
        }
    }

    /**
     * 用于描述包含了“这些”组件的实体，这个实体除了包含这些组件还可以包含其他组件
     */
    class AllOf extends BaseOf {
        public isMatch(entity: Entity): boolean {
            return ((entity.componentFlag[0] & this.componentFlag[0]) === this.componentFlag[0]) && ((entity.componentFlag[1] & this.componentFlag[1]) === this.componentFlag[1]);
        }

        getKey(): string {
            return 'allOf:' + this.toString();
        }
    }

    /**
     * 用于描述只包含指定组件的逻辑
     */
    class OnlyOf extends BaseOf {

        constructor(...args: number[]) {
            super(...args);
            let ctors = getComponentConstructors();
            this.indices = new Array(ctors.length);
            for(let i = 0, len = ctors.length; i < len; i++) {
                this.indices[i] = ctors[i].tid;
            }
        }

        public getKey(): string {
            return 'onlyOf:' + this.toString();
        }

        public isMatch(entity: Entity): boolean {
            return (entity.componentFlag[0] === this.componentFlag[0]) && (entity.componentFlag[1] === this.componentFlag[1]);
        }
    }

    /**
     * 不包含所有这里面的组件（“与”关系）
     */
    class NoneAllOf extends AnyOf {

        public getKey(): string {
            return 'noneAllOf:' + this.toString();
        }

        public isMatch(entity: Entity): boolean {
            return !super.isMatch(entity);
        }
    }

    export class Matcher {

        private rules: BaseOf[] = [];
        private _indices: number[] = null;
        /**
         * 匹配器关注的组件索引。在创建Group时，Context根据组件id去给Group关联组件的添加和移除事件。
         */
        public get indices() {
            if (this._indices === null) {
                this._indices = [];
                this.rules.forEach((rule) => {
                    Array.prototype.push.apply(this._indices, rule.indices);
                });
            }
            return this._indices;
        }

        public static get newInst() {
            return new Matcher();
        }

        /**
         * 组件间是或的关系，表示关注拥有任意一个这些组件的实体。
         * @param args 组件索引
         */
        public anyOf(...args: ComponentConstructor<IComponent>[]): Matcher {
            let newArgs = [];
            for (let i = 0, len = args.length; i < len; i++) {
                newArgs.push(args[i].tid);
            }
            this.rules.push(new AnyOf(...newArgs));
            return this;
        }

        /**
         * 组件间是与的关系，表示关注拥有所有这些组件的实体。
         * @param args 组件索引
         */
        public allOf(...args: ComponentConstructor<IComponent>[]): Matcher {
            let newArgs = [];
            for (let i = 0, len = args.length; i < len; i++) {
                newArgs.push(args[i].tid);
            }
            this.rules.push(new AllOf(...newArgs));
            return this;
        }

        /**
         * 表示关注只拥有这些组件的实体
         * @param args 组件索引
         */
        public onlyOf(...args: ComponentConstructor<IComponent>[]): Matcher {
            let newArgs = [];
            for (let i = 0, len = args.length; i < len; i++) {
                newArgs.push(args[i].tid);
            }
            this.rules.push(new AllOf(...newArgs));
            let ctors = getComponentConstructors();
            let otherTids = [];
            for(let ctor of ctors) {
                if(newArgs.indexOf(ctor.tid) < 0) {
                    otherTids.push(ctor.tid);
                }
            }
            this.rules.push(new NoneAllOf(...otherTids));
            return this;
        }

        /**
         * 表示不包含所有这里面的组件（“与”关系）。
         * @param args 
         */
        public noneAllOf(...args: ComponentConstructor<IComponent>[]) {
            let newArgs = [];
            for (let i = 0, len = args.length; i < len; i++) {
                newArgs.push(args[i].tid);
            }
            this.rules.push(new NoneAllOf(...newArgs));
            return this;
        }

        public getKey(): string {
            let s = '';
            for (let i = 0; i < this.rules.length; i++) {
                s += this.rules[i].getKey()
                if (i < this.rules.length - 1) {
                    s += '|'
                }
            }
            return s;
        }

        public isMatch(entity: Entity): boolean {
            if (this.rules.length === 1) {
                return this.rules[0].isMatch(entity);
            }
            else if (this.rules.length === 2) {
                return this.rules[0].isMatch(entity) && this.rules[1].isMatch(entity);
            }
            else if (this.rules.length === 3) {
                return this.rules[0].isMatch(entity) && this.rules[1].isMatch(entity) && this.rules[2].isMatch(entity);
            }
            else {
                for (let i = 0; i < this.rules.length; i++) {
                    if (!this.rules[i].isMatch(entity)) {
                        return false;
                    }
                }
                return true;
            }
        }
    }

    /**
     * 每一帧都会去执行的系统
     */
    export abstract class ExecuteSystem<E extends Entity> implements IExecuteSystem {

        /**
         * 当前系统关系的组件
         */
        public readonly group: Group<E>;
        protected context: Context<E> = null;

        /**
         * 缓存当前系统收集到的感兴趣的实体。
         */
        private buffer: E[] = [];

        /**
         * 帧时间
         */
        protected dt: number = 0;

        constructor(context: Context<E>) {
            this.context = context;
            this.group = context.createGroup(this.filter(), 'e');
        }

        /**
         * 不需要经过group的判断，无条件执行。
         */
        init(): void {

        }

        execute(dt: number): void {
            this.dt = dt;
            /**
             * 加个缓冲层，这样在当前帧中如果有实体删除了组件，不会影响到当前帧_buffer中的实体，但是实体的组件被移除了会导致获取不到组件对象。
             * 在系统中尽量不要直接移除当前系统所关心实体的组价，如果移除了那么在当前系统中获取那个组件的时候还需要额外写if代码进行判断组件是否存在。
             */
            // TODO: 看看能不能优化这里
            Array.prototype.push.apply(this.buffer, this.group.matchEntities);
            this.update(this.buffer);
            this.buffer.length = 0;
        }
        /**
         * 实体过滤规则
         * 
         * 根据提供的组件过滤实体。
         */
        abstract filter(): Matcher;
        abstract update(entities: E[]): void;
    }
    /**
     * 响应式的系统，每次执行完后都会移除当前收集的实体。
     * 
     * 如果实体添加组件后需要在ReactiveSystem里面执行，在修改组件数据的时候需要使用replace**修改组件数据的方法。
     * 
     * 可实现只执行一次的系统。
     */
    export abstract class ReactiveSystem<E extends Entity> implements IReactiveSystem {

        /**
         * 当前系统关系的组件
         */
        public readonly group: Group<E>;
        protected context: Context<E> = null;

        private buffer: E[] = [];

        constructor(context: Context<E>) {
            this.context = context;
            this.group = context.createGroup(this.filter(), 'r');
        }

        init() {

        }

        execute(dt: number): void {
            /**
             * 加个缓冲层，这样在当前帧中如果有实体删除了组件，不会影响到当前帧buffer中的实体
             */
            Array.prototype.push.apply(this.buffer, this.group.matchEntities);
            this.group.clearCollectedEntities();
            this.update(this.buffer);
            this.buffer.length = 0;
        }
        /**
         * 实体过滤规则
         * 
         * 根据提供的组件过滤实体。
         */
        abstract filter(): Matcher;
        abstract update(entities: E[]): void;
    }

    /**
     * 结合ExecuteSystem和ReactiveSystem的特性，可以同时处理实体进入System的逻辑，和每帧的逻辑。
     */
    export abstract class RExecuteSystem<E extends Entity> implements IRExecuteSystem {
        public readonly group: Group<Entity>;
        public readonly rGroup: Group<Entity>;

        protected context: Context<E> = null;
        private eBuffer: E[] = [];
        private rBuffer: E[] = [];
        protected dt: number = 0;

        constructor(context: Context<E>) {
            this.context = context;
            this.group = context.createGroup(this.filter(), 'e');
            this.rGroup = context.createGroup(this.filter(), 'r');
        }

        init(): void {
            
        }

        execute(dt: number): void {
            this.dt = dt;
            // 处理刚进来的实体
            if(this.rGroup.count > 0) {
                Array.prototype.push.apply(this.rBuffer, this.rGroup.matchEntities);
                this.rGroup.clearCollectedEntities();
                this.entityEnter(this.rBuffer);
                this.rBuffer.length = 0;
            }
            // 
            Array.prototype.push.apply(this.eBuffer, this.group.matchEntities);
            this.update(this.eBuffer);
            this.eBuffer.length = 0;
        }
        
        /**
         * 实体过滤规则
         * 
         * 根据提供的组件过滤实体。
         */
        abstract filter(): Matcher;
        abstract entityEnter(entities: E[]): void;
        abstract update(entities: E[]): void;
    }

    /**
     * System的root，对游戏中的System遍历从这里开始。
     */
    export class RootSystem implements ISystem {
        private executeSystemFlows: IExecuteSystem[] = [];

        private debugInfo: HTMLElement;
        private executeCount: {[key: string]: number} = null;

        constructor() {
            
        }

        initDebug() {
            this.executeCount = Object.create(null);
            this.debugInfo = document.createElement('debugInfo');
            this.debugInfo.style.position = 'absolute'
            this.debugInfo.style.top = '20px';
            this.debugInfo.style.left = '10px';
            this.debugInfo.style.color = '#ffffff';
            document.body.appendChild(this.debugInfo);

            for(let sys of this.executeSystemFlows) {
                this.executeCount[sys['__proto__'].constructor.name] = 0;
            }
        }

        add(system: ISystem) {
            if (system instanceof System) { // 将嵌套的System都“摊平”，放在根System中进行遍历，减少execute的频繁进入退出。
                Array.prototype.push.apply(this.executeSystemFlows, system.executeSystems);
                system.executeSystems.length = 0;
            }
            else {
                this.executeSystemFlows.push(system as IExecuteSystem);
            }
            return this;
        }

        init() {
            for (let sys of this.executeSystemFlows) {
                sys.init();
            }
        }

        execute(dt: number) {
            for (let sys of this.executeSystemFlows) {
                if (sys.group.count > 0) { // 与System关联的Group如果没有实体，则不去执行这个System。
                    sys.execute(dt);
                }
            }
        }

        debugExecute(dt: number) {
            let s = '';
            for (let sys of this.executeSystemFlows) {
                let sysName = sys['__proto__'].constructor.name;
                let startTime = Date.now();
                if (sys.group.count > 0) { // 与System关联的Group如果没有实体，则不去执行这个System。
                    sys.execute(dt);
                    this.executeCount[sysName]++;
                }
                let endTime = Date.now();
                let color = sys.group.count === 0 ? 'white' : 'green'
                s += `<font blod="" color="${color}"><b>${sysName}: ${endTime - startTime} ms\n`;
                if(sys instanceof ReactiveSystem) {
                    s += `  |_execute count: ${this.executeCount[sysName]}\n`;
                }
                if(sys.group.count > 0) {
                    s += `  |_entity count: ${sys.group.count}\n`;
                }
                s += '</b></font>';
            }
            this.debugInfo.innerHTML = `<pre>${s}</pre>`;
        }
    }

    /**
     * 系统组合器，用于将多个相同功能模块的系统逻辑上放在一起。System也可以嵌套System。
     */
    export class System implements ISystem {
        executeSystems: IExecuteSystem[] = [];

        constructor() {

        }

        add(system: ISystem) {
            if (system instanceof System) {
                Array.prototype.push.apply(this.executeSystems, system.executeSystems);
                system.executeSystems.length = 0;
            }
            else {
                this.executeSystems.push(system as IExecuteSystem);
            }
            return this;
        }
    }
}