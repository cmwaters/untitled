process.env.NODE_ENV = "test";
import chai from "chai";
import chaiHttp from "chai-http";
import * as dotenv from "dotenv";
import {
    setupUsersAndTokens,
    clearUsers,
    clearStoriesAndCards,
    createStory,
    addUserPermission,
    addCardAbove,
} from "./test_utils";
let should = chai.should();
dotenv.config({ path: `config/.env.${process.env.NODE_ENV}` });
import { app } from "../index";
import { expect } from "chai";
import { CardModel } from "../models/card";
import { PermissionGroup, permissionString } from "../services/permissions";

const defaultCardText = "default test card text";

chai.use(chaiHttp);
describe.only("Card", () => {
    let test_env: any;

    before((done) => {
        clearUsers();
        clearStoriesAndCards();
        done();
    });

    afterEach((done) => {
        clearUsers();
        clearStoriesAndCards();
        done();
    });

    beforeEach((done) => {
        setupUsersAndTokens(["owner", "author", "editor", "viewer", "none"]).then((resp: any[]) => {
            test_env = {
                users: resp,
                story: "",
                rootCard: "",
            };
            createStory("Test Story", test_env.users[0].token).then(async (res: any) => {
                test_env.story = res.story._id;
                test_env.rootCard = res.rootCard._id;
                await addUserPermission(test_env.users[1].id, res.story._id, PermissionGroup.Author);
                await addUserPermission(test_env.users[2].id, res.story._id, PermissionGroup.Editor);
                await addUserPermission(test_env.users[3].id, res.story._id, PermissionGroup.Viewer);
                done();
            });
        });
    });

    describe("/GET cards", () => {
        let testResults = [true, true, true, true, false];

        testResults.forEach((success, index) => {
            let name = permissionString[4 - index] + " should not return all the story's cards";
            if (success) {
                name = permissionString[4 - index] + " should return all the story's cards";
            }
            it(name, (done) => {
                CardModel.create({
                    story: test_env.story,
                    depth: 0,
                    index: 1,
                    text: "Hello World",
                }).catch((err) => console.error(err));
                chai.request(app)
                    .get("/api/cards/")
                    .query({ token: test_env.users[index].token })
                    .send({ story: test_env.story })
                    .end((err, res) => {
                        if (success) {
                            res.should.have.status(200);
                            res.body.should.have.property("cards");
                            res.body.cards.should.have.length(2);
                        } else {
                            res.should.have.status(401);
                        }
                        done();
                    });
            });
        });
    });

    // this is a limited test because we don't check to see if the card would pair with a card
    // above it and with a parent if it had it (only that it pairs with the card below).
    // We can test these later with fuzzy testing
    describe("/POST create card above", () => {
        let testResults = [true, true, false, false, false];

        testResults.forEach((success, index) => {
            let name = permissionString[4 - index] + " should not be able to create a card above";
            if (success) {
                name = permissionString[4 - index] + " should be able to create a card above";
            }
            it(name, (done) => {
                chai.request(app)
                    .post("/api/card/above")
                    .query({ token: test_env.users[index].token })
                    .send({ story: test_env.story, sibling: test_env.rootCard, text: defaultCardText })
                    .end((err, res) => {
                        if (success) {
                            res.should.have.status(201);
                            res.body.should.have.property("card");
                            // we just want the output to be the id, not the entire story
                            res.body.card.should.have.property("story");
                            res.body.card.story.should.equal(test_env.story)
                            res.body.card.text.should.equal(defaultCardText);
                        } else {
                            res.should.have.status(401);
                        }
                        CardModel.find({ story: test_env.story }, (err, cards) => {
                            if (success) {
                                expect(cards).to.have.length(2);
                                cards[0].index.should.equal(0);
                                cards[1].index.should.equal(1);
                                cards[0].below!._id.toString().should.equal(cards[1].id);
                                cards[1].above!._id.toString().should.equal(cards[0].id);
                            } else {
                                expect(cards).to.have.length(1);
                            }
                            done();
                        });
                    });
            });
        });
    });

    describe("/POST create card below", () => {
        let testResults = [true, true, false, false, false];

        testResults.forEach((success, index) => {
            let name = permissionString[4 - index] + " should not be able to create a card above";
            if (success) {
                name = permissionString[4 - index] + " should be able to create a card above";
            }
            it(name, (done) => {
                addCardAbove(test_env.story, test_env.rootCard, test_env.users[0].token)
                    .then((card) => {
                        chai.request(app)
                            .post("/api/card/below")
                            .query({ token: test_env.users[index].token })
                            .send({ story: test_env.story, sibling: card._id, text: defaultCardText })
                            .end((err, res) => {
                                if (success) {
                                    res.should.have.status(201);
                                    res.body.should.have.property("card");
                                    // we just want the output to be the id, not the entire story
                                    res.body.card.should.have.property("story");
                                    res.body.card.story.should.equal(test_env.story)
                                    res.body.card.text.should.equal(defaultCardText);
                                } else {
                                    res.should.have.status(401);
                                }
                                CardModel.find({ story: test_env.story }, (err, cards) => {
                                    if (success) {
                                        expect(cards).to.have.length(3);
                                        cards[0].index.should.equal(0);
                                        cards[1].index.should.equal(1);
                                        cards[2].index.should.equal(2);
                                        cards[0].below!._id.toString().should.equal(cards[1].id);
                                        cards[1].above!._id.toString().should.equal(cards[0].id);
                                        cards[1].below!._id.toString().should.equal(cards[2].id);
                                        cards[2].above!._id.toString().should.equal(cards[1].id);
                                    } else {
                                        expect(cards).to.have.length(2);
                                    }
                                    done();
                                });
                            });
                    })
                    .catch((err) => console.error(err));
            });
        });
    });

    describe("/POST create card below", () => {
        let testResults = [true, true, false, false, false];

        testResults.forEach((success, index) => {
            let name = permissionString[4 - index] + " should not be able to create a card above";
            if (success) {
                name = permissionString[4 - index] + " should be able to create a card above";
            }
            it(name, (done) => {
                chai.request(app)
                    .post("/api/card/child")
                    .query({ token: test_env.users[index].token })
                    .send({ story: test_env.story, parent: test_env.rootCard, text: defaultCardText })
                    .end((err, res) => {
                        if (success) {
                            res.should.have.status(201);
                            res.body.should.have.property("card");
                            // we just want the output to be the id, not the entire story
                            res.body.card.should.have.property("story");
                            res.body.card.story.should.equal(test_env.story)
                            res.body.card.text.should.equal(defaultCardText);
                        } else {
                            res.should.have.status(401);
                        }
                        CardModel.find({ story: test_env.story }, (err, cards) => {
                            if (success) {
                                expect(cards).to.have.length(2);
                                cards[0].index.should.equal(0);
                                cards[0].depth.should.equal(0);
                                cards[1].index.should.equal(0);
                                cards[1].depth.should.equal(1);
                                cards[0].children![0]._id.toString().should.equal(cards[1].id);
                                cards[1].parent!._id.toString().should.equal(cards[0].id);
                            } else {
                                expect(cards).to.have.length(1);
                            }
                            done();
                        });
                    });
            });
        });
    });
});
