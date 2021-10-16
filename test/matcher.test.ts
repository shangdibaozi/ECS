import { ecs } from "../ECS";


@ecs.register('Run')
class RunComp extends ecs.Comp {
    reset() {}
}

@ecs.register('Render')
class RenderComp extends ecs.Comp {
    reset() {}
}

@ecs.register('Jump')
class JumpComp extends ecs.Comp {
    reset() {}
}

@ecs.register('Fly')
class FlyComp extends ecs.Comp {
    reset() {}
}

test('ecs.allOf', () => {
    let ent = ecs.createEntity();
    ent.add(RenderComp);
    ent.add(RunComp);
    let matcher = ecs.allOf(RenderComp, RunComp);
    
    expect(matcher.isMatch(ent)).toBe(true);

    expect(matcher.indices.toString()).toBe(`${RunComp.tid},${RenderComp.tid}`);

    ent.remove(RunComp);
    expect(matcher.isMatch(ent)).toBe(false);

    ent.add(RunComp);
    ent.add(JumpComp);
    expect(matcher.isMatch(ent)).toBe(true);
});

test('ecs.anyOf', () => {
    let ent = ecs.createEntity();
    ent.add(RenderComp);
    ent.add(RunComp);
    

    let mathcer = ecs.anyOf(RunComp, JumpComp);
    expect(mathcer.isMatch(ent)).toBe(true);

    ent.add(JumpComp);
    expect(mathcer.isMatch(ent)).toBe(true);

    ent.remove(RunComp);
    expect(mathcer.isMatch(ent)).toBe(true);

    ent.remove(JumpComp);
    expect(mathcer.isMatch(ent)).toBe(false);
});

test('ecs.excludeOf', () => {
    let ent = ecs.createEntity();
    ent.add(RunComp);

    let matcher = ecs.excludeOf(RunComp);

    expect(matcher.isMatch(ent)).toBe(false);

    ent.add(FlyComp);
    expect(matcher.isMatch(ent)).toBe(false);

    ent.remove(RunComp);
    expect(matcher.isMatch(ent)).toBe(true);
});

test('ecs.onlyOf', () => {
    let ent = ecs.createEntity();
    ent.add(RunComp);

    let matcher = ecs.onlyOf(RunComp);
    expect(matcher.isMatch(ent)).toBe(true);

    ent.add(FlyComp);
    expect(matcher.isMatch(ent)).toBe(false);

    ent.remove(FlyComp);
    expect(matcher.isMatch(ent)).toBe(true);
});

test('ecs.allOf().excludeOf', () => {
    let ent = ecs.createEntity();
    ent.add(RenderComp);
    ent.add(RunComp);
    ent.add(JumpComp);
    
    let macher = ecs.allOf(RenderComp, RunComp, JumpComp).excludeOf(FlyComp);
    expect(macher.isMatch(ent)).toBe(true);

    ent.add(FlyComp);
    expect(macher.isMatch(ent)).toBe(false);

    ent.remove(JumpComp);
    expect(macher.isMatch(ent)).toBe(false);

    ent.remove(FlyComp);
    ent.add(JumpComp);
    expect(macher.isMatch(ent)).toBe(true);
});