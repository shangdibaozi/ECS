import { ecs } from "../ECS";

@ecs.register('Test1')
class Test1Comp extends ecs.Comp {
    reset() {

    }
}

@ecs.register('Test2', false)
class Test2Comp extends ecs.Comp {
    reset() {

    }
}

test('register()', () => {
    let comp1 = ecs.createEntityWithComp(Test1Comp);
    expect(comp1).not.toBe(null);

    try {
        let comp2 = ecs.createComp(Test2Comp);
    } catch (error) {
        console.log(error);
    }
});