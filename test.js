export class Node {
    constructor (value)  {
        this.value = value;
    }

    get 0() {
        return 'adam';
    }
}

const node = new Node(5);
console.log(node[0]);