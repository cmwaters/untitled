import { User, UserModel } from '../models/user'
import { Card, CardModel } from '../models/card'
import { Story, StoryModel } from '../models/header'
import { LoremIpsum } from "lorem-ipsum";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

const lorem = new LoremIpsum({
    sentencesPerParagraph: {
        max: 8,
        min: 4
    },
    wordsPerSentence: {
        max: 16,
        min: 4
    }
});

type Document = {
    cards: Card[][],
    story: Story
}

export class Generator {
    documents: { [title: string]: Document } = {};
    users: { [name: string]: User } = {};

    currentStory: string = "";
    pillarRatio: number[] = [0.4, 0.2, 0.4];
    cardsPerParent: number = 3;

    constructor(users?: { [name: string]: User }, documents?: { [title: string]: Document}) {
        if (users) this.users = users
        if (documents) this.documents = documents
    }

    static async createUsers(users: string[]): Promise<Generator> {
        let newUsers: { [name: string]: User } = {};
        try {
            for (const user of users) {
                const salt = randomBytes(32);
                const passwordHashed = await argon2.hash(user, { salt });
                newUsers[user] = await UserModel.create({
                    username: user,
                    email: user + "@example.com",
                    password: passwordHashed,
                    stories: [],
                    lastStory: undefined,
                    name: user,
                })
            }
        } catch(err) { throw err; }
        return new Generator(newUsers)
    }

    async createStory(user: string, title: string, cards: number): Promise<Generator> {
        let u = this.users[user]
        try {
            this.documents[title] = {
                story: await StoryModel.create({
                    owner: u,
                    title: title,
                    cardCounter: 0,
                    description: lorem.generateParagraphs(1)
                }),
                cards: [],
            }
            this.documents[title].cards.push(await generateCards(this.documents[title].story, 0, cards))
        } catch (error) { throw error }
        this.currentStory = title
        if (!u.stories) {
            u.stories = [this.documents[title].story._id]
        } else {
            u.stories.push(this.documents[title].story._id)
        }
        u.lastStory = this.documents[title].story._id
        await u.save()
        return this
    }

    card(depth: number, index: number, story?: string) {
        if (story) {
            return this.documents[story].cards[depth][index]
        }
        return this.documents[this.currentStory].cards[depth][index]
    }

    // CONTRACT: the parent card should always be below any other parents that have children
    async addCardFamily(parent: Card, cards: number, story?: string): Promise<Generator> {
        if (!story) story = this.currentStory
        let newCards: Card[] = await generateCards(this.documents[story].story, parent.depth + 1, cards, parent)
        if (this.documents[story].cards.length === parent.depth + 1) {
            this.documents[story].cards.push(newCards)
        } else {
            let pillarLength = this.documents[story].cards[parent.depth + 1].length
            this.documents[story].cards[parent.depth + 1][pillarLength - 1].below = newCards[0]._id
            await this.documents[story].cards[parent.depth + 1][pillarLength - 1].save()
            newCards[0].above = this.documents[story].cards[parent.depth + 1][pillarLength - 1]._id
            await newCards[0].save()
            this.documents[story].cards[parent.depth + 1].push(...newCards)
        }
        // update parent
        parent.children = newCards
        await parent.save()
        return this
    }

    async addEditor(user: string, story: string): Promise<Generator> {
        let u = this.users[user]
        let s = this.documents[story].story
        if (s.editors) {
            s.editors.push(u)
        } else {
            s.editors = [u]
        }
        await this.documents[story].story.save()
        u.stories.push(this.documents[story].story._id)
        await u.save()
        return this
    }
}

async function generateCards(story: Story, depth: number, range: number, parent?: Card, above?: Card, below?: Card): Promise<Card[]> {
    let column = [];
    for (let index = 0; index < range; index++) {
        column.push(await CardModel.create({
            story: story._id,
            text: lorem.generateParagraphs(1),
            depth: depth,
            identifier: story.cardCounter + index + 1,
        }))
    }

    story.cardCounter += range
    story.save()

    for (let index = 0; index < range; index++) {
        if (parent !== undefined) {
            column[index].parent = parent._id
            parent.children!.push(column[index]._id)
        }
        if (index !== 0) {
            column[index].above = column[index - 1]._id
        } else if (above) {
            column[index].above = above._id
            above.below = column[index]._id
            await above.save()
        }
        if (index !== range - 1) {
            column[index].below = column[index + 1]._id
        } else if (below) {
            column[index].below = below._id 
            below.above = column[index]._id
            await below.save()
        }
        await column[index].save()
    }

    if (parent !== undefined) {
        await parent.save()
    }

    return column
} 
