import { ecs } from "../ECS";

@ecs.register('Comp1')
class Comp1 extends ecs.Comp {
    reset() {

    }
}

@ecs.register('Comp2')
class Comp2 extends ecs.Comp {
    reset() {

    }
}

@ecs.register('Comp3')
class Comp3 extends ecs.Comp {
    reset() {

    }
}

test('Comp.tid', () => {
    expect(Comp1.tid).toBe(0);
    expect(Comp2.tid).toBe(1);
    expect(Comp3.tid).toBe(2);
});

@ecs.registerTag()
class CompTag {
    static Tag1: number = 0;
    static Tag2: number = 0;
    static Tag3: number = 0;
}

test('Comp tag', () => {
    expect(CompTag.Tag1).toBe(3);
    expect(CompTag.Tag2).toBe(4);
    expect(CompTag.Tag3).toBe(5);
});

test('singleton comp', () => {
    let comp = ecs.getSingleton(Comp1);

    expect(comp).toBe(ecs.getSingleton(Comp1));
    expect(comp.ent).toBe(ecs.getSingleton(Comp1).ent);


    let compObj = new Comp2();
    ecs.addSingleton(compObj);

    expect(compObj).toBe(ecs.getSingleton(Comp2));
    expect(compObj.ent).toBe(ecs.getSingleton(Comp2).ent);
});