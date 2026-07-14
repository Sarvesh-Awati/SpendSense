export abstract class BaseRepository<T> {
  protected modelDelegate: any;

  constructor(modelDelegate: any) {
    this.modelDelegate = modelDelegate;
  }

  async findById(id: string): Promise<T | null> {
    return this.modelDelegate.findUnique({
      where: { id },
    });
  }

  async findAll(params?: {
    where?: any;
    orderBy?: any;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    return this.modelDelegate.findMany({
      where: params?.where,
      orderBy: params?.orderBy,
      skip: params?.skip,
      take: params?.take,
    });
  }

  async create(data: any): Promise<T> {
    return this.modelDelegate.create({
      data,
    });
  }

  async update(id: string, data: any): Promise<T> {
    return this.modelDelegate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<T> {
    return this.modelDelegate.delete({
      where: { id },
    });
  }

  async count(where?: any): Promise<number> {
    return this.modelDelegate.count({ where });
  }
}
