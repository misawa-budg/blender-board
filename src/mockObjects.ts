export type Model = {
    "id": number,
    "title": string,
    "author": string,
    "createdAt": string,
    "filename": string
};

export const mockModels: Model[] = [
    {
        id : 1,
        title : "Model 1",
        author : "Author 1",
        createdAt : "2024-01-01T00:00:00Z",
        filename : "model1.obj"
    },
    {
        id : 2,
        title : "Model 2",
        author : "Author 2",
        createdAt : "2024-02-01T00:00:00Z",
        filename : "model2.obj"
    },
    {
        id : 3,
        title : "Model 3",
        author : "Author 3",
        createdAt : "2024-03-01T00:00:00Z",
        filename : "model3.obj"
    },
    {
        id : 4,
        title : "Model 4",
        author : "Author 4",
        createdAt : "2024-04-01T00:00:00Z",
        filename : "model4.obj"
    }
];
