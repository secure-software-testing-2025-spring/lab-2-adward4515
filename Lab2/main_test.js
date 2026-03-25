const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const { Application, MailSystem } = require('./main');

// 建立一個暫時的 name_list.txt 讓 Application.getNames() 能夠順利讀取以達成覆蓋率
fs.writeFileSync('name_list.txt', 'Alice\nBob\nCharlie');

test('MailSystem - write', () => {
    const ms = new MailSystem();
    const result = ms.write('Alice');
    assert.strictEqual(result, 'Congrats, Alice!');
});

test('MailSystem - send (success branch)', (t) => {
    const ms = new MailSystem();
    // Stub: 讓 Math.random 回傳 0.6 (> 0.5)，測試成功的分支
    t.mock.method(Math, 'random', () => 0.6);
    const result = ms.send('Alice', 'Context');
    assert.strictEqual(result, true);
});

test('MailSystem - send (failure branch)', (t) => {
    const ms = new MailSystem();
    // Stub: 讓 Math.random 回傳 0.4 (<= 0.5)，測試失敗的分支
    t.mock.method(Math, 'random', () => 0.4);
    const result = ms.send('Alice', 'Context');
    assert.strictEqual(result, false);
});

test('Application - constructor and getNames', async () => {
    const app = new Application();
    // 測試直接呼叫 getNames
    const [people, selected] = await app.getNames();
    assert.deepStrictEqual(people, ['Alice', 'Bob', 'Charlie']);
    assert.deepStrictEqual(selected, []);
    
    // 等待 constructor 內的 Promise 執行完畢，覆蓋 .then() 區塊
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepStrictEqual(app.people, ['Alice', 'Bob', 'Charlie']);
});

test('Application - getRandomPerson', (t) => {
    const app = new Application();
    app.people = ['Alice', 'Bob', 'Charlie'];
    // Stub: 讓 Math.random 永遠回傳 0.9 (會選到陣列最後一個元素 'Charlie')
    t.mock.method(Math, 'random', () => 0.9);
    assert.strictEqual(app.getRandomPerson(), 'Charlie');
});

test('Application - selectNextPerson (all selected branch)', () => {
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    app.selected = ['Alice', 'Bob']; // 設定為全部皆已選擇
    const result = app.selectNextPerson();
    assert.strictEqual(result, null); // 應該提早 return null
});

test('Application - selectNextPerson (while loop branch)', (t) => {
    const app = new Application();
    app.people = ['Alice', 'Bob', 'Charlie'];
    app.selected = ['Alice']; // Alice 已經被選過了

    let callCount = 0;
    // Stub: 控制 Math.random 的回傳序列
    t.mock.method(Math, 'random', () => {
        callCount++;
        // 第一次讓它抽中已選擇的 'Alice' (觸發 while 迴圈)
        // 第二次讓它抽中尚未選擇的 'Bob' (跳出 while 迴圈)
        return callCount === 1 ? 0 : 0.5; 
    });

    const result = app.selectNextPerson();
    assert.strictEqual(result, 'Bob');
    assert.deepStrictEqual(app.selected, ['Alice', 'Bob']);
});

test('Application - notifySelected', (t) => {
    const app = new Application();
    app.selected = ['Alice', 'Bob'];

    // Mock/Spy: 攔截 mailSystem 的 write 和 send 方法
    const writeSpy = t.mock.method(app.mailSystem, 'write', () => 'Mock Context');
    const sendSpy = t.mock.method(app.mailSystem, 'send', () => true);

    app.notifySelected();

    // 驗證 write 被呼叫了 2 次，且參數正確
    assert.strictEqual(writeSpy.mock.calls.length, 2);
    assert.strictEqual(writeSpy.mock.calls[0].arguments[0], 'Alice');
    assert.strictEqual(writeSpy.mock.calls[1].arguments[0], 'Bob');

    // 驗證 send 被呼叫了 2 次，且參數正確
    assert.strictEqual(sendSpy.mock.calls.length, 2);
    assert.strictEqual(sendSpy.mock.calls[0].arguments[0], 'Alice');
    assert.strictEqual(sendSpy.mock.calls[0].arguments[1], 'Mock Context');
});