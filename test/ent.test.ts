import { ecs } from "../ECS";

class Ent extends ecs.Entity {
    Move: MoveComp;
}

@ecs.register('Move')
class MoveComp extends ecs.Comp {

    reset() {

    }
}

@ecs.register('Obj', false)
class ObjComp extends ecs.Comp {
    reset() {

    }
}

test('ent.add(MoveComp)', () => {
    let ent = ecs.createEntity<Ent>();
    let move = ent.add(MoveComp);
    expect(ent.has(MoveComp)).toBe(true);
    expect(ent.Move).toBe(move);
    expect(ent.get(MoveComp)).toBe(move);
});

test('ent.remove(MoveComp)', () => {
    let ent = ecs.createEntity<Ent>();
    ent.add(MoveComp);
    ent.remove(MoveComp);
    expect(ent.has(MoveComp)).toBe(false);
    expect(ent.Move).toBe(null);
});

test('ent.add(obj)', () => {
    let move = new MoveComp();
    
    expect(move.constructor).toBe(MoveComp);
    expect((move.constructor as unknown as ecs.CompCtor<MoveComp>).tid).toBe(MoveComp.tid);
    let ent = ecs.createEntity<Ent>();
    ent.add(move);
    expect(ent.has(MoveComp)).toBe(true);
    expect(ent.Move).toBe(move);
    expect(ent.get(MoveComp)).toBe(move);
});

@ecs.registerTag()
class ECSTag {
    static Tag1: number = 0;
    static Tag2: number = 0;
    static Tag3: number = 0;
}

test('ent.add(tag)', () => {
    let ent = ecs.createEntity();
    ent.add(ECSTag.Tag1);

    expect(ent.has(ECSTag.Tag1)).toBe(true);
    expect(ent.get(ECSTag.Tag1)).toBe(ECSTag.Tag1);

    ent.remove(ECSTag.Tag1);
    expect(ent.has(ECSTag.Tag1)).toBe(false);
    expect(ent.get(ECSTag.Tag1)).toBe(null);
});

test('ent destroy', () => {
    let ent = ecs.createEntity();
    ent.add(MoveComp);
    ent.add(new ObjComp());

    ent.destroy();
    expect(ent.has(MoveComp)).toBe(false);
    expect(ent.has(ObjComp)).toBe(false);
});