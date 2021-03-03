import { Node, Pos } from "../src/node"
import chai from "chai"
let expect = chai.expect

const div = document.createElement('div');
div.id = "test-container"
div.style.width = "100%";
div.style.height = "100vh";
document.body.appendChild(div)

beforeEach(() => {
    div.innerHTML = "";
})

export class TreeTypology {
    pillars: PillarTypology[] = []

    constructor(families?: number[]) {
        if (families) {
            this.pillars = [{ families }]
        }
    }

    pillar(families: number[]): TreeTypology {
        this.pillars.push({ families })
        return this
    }

    nodes(): Node[] {
        let nodes: Node[] = []
        let uid = 0
        this.pillars.forEach((pillar, depth) => {
            pillar.families.forEach((fam, family) => {
                for (let index = 0; index < fam; index++) {
                    let pos = new Pos(depth, family, index)
                    let node = {
                        uid: uid,
                        pos: pos,
                        text: pos.string(),
                    }
                    nodes.push(node)
                    uid++
                }
            })
        })
        return nodes
    }
}

export type PillarTypology = {
    families: number[]
}

export function assertTypology(el: HTMLElement, typology: TreeTypology): void {
    // assert that the element has a reference
    expect(el.children.length).to.equal(1)
    expect(el.children[0].className).to.equal("reference")

    let reference = el.children[0]

    // assert that there are enough pillars (remeber there is always one pillar
    // more than what is initially created)
    expect(reference.children.length).to.equal(typology.pillars.length + 1)

    for (let i = 0; i < typology.pillars.length; i++) {
        let pillarEl = reference.children[i]
        let pillar = typology.pillars[i]
        expect(pillarEl.className).to.equal("pillar")
        expect(pillarEl.children.length).to.equal(pillar.families.length)
        for (let j = 0; j < pillar.families.length; j++) {
            let familyEl = pillarEl.children[j]
            expect(familyEl.className).to.equal("family")
            expect(familyEl.children.length).to.equal(pillar.families[j])
            for (let k = 0; k < pillar.families[j]; k++) {
                let cardEl = familyEl.children[k]
                expect(cardEl.className).to.equal("card ql-container")
            }
        }
    }
}

export function getNodeAsElement(el: HTMLElement, pos: Pos): HTMLElement {
    return el.children[0].children[pos.depth].children[pos.family].children[pos.index] as HTMLElement
}