import { Broker } from '../amqp'

declare var process: {
  env: {
    AMQP_SERVICE: string,
  }
}
class BaseRepository {
  model: any = undefined;
  constructor(mongooseModel: any) {
    this.model = mongooseModel;
  }
  public async findOne(query: any, options: any): Promise<any> {
    let option = { ...options };
    let populate = option.populate;
    delete option.populate;
    if (populate && populate !== undefined && populate !== "") {
      if (typeof populate === 'string') {
        populate = JSON.parse(populate)
      }
      return this.model.findOne(query, option).populate(populate);
    } else {
      return this.model.findOne(query, option);
    }
  }
  public async find(query: any = {}, options: any = {}): Promise<any> {

    let page = {
      data: [],
      total: 0,
      limit: +options.limit || 10,
      page: +options.page || 1,
      hasNext: false
    }

    if (query) {
      if (typeof query === 'string') {
        query = JSON.parse(query)
      }
      // query = {name: 'd,dd,ddd'} => {name: ['d, 'dd', 'ddd']
      Object.keys(query).map(key => {
        if (typeof query[key] === "string") {
          query[key] = query[key].split(",");
        }
      })
    }
    if (options) {
      // options = {sort: '{"name": 1}"'}
      if (typeof options.sort === 'string') {
        options.sort = JSON.parse(options.sort)
      }
      if (typeof options.populate === 'string') {
        options.populate = JSON.parse(options.populate)
      }
    }

    if (
      this.model.paginate &&
      (options.page !== undefined && options.limit !== undefined)
    ) {
      if (options.page < 1) throw new Error("page start with 1");
      let result = null;
      if (
        options.populate &&
        options.populate !== undefined &&
        options.populate !== ""
      ) {
        result = await this.model.paginate(query, {
          limit: +options.limit,
          page: +options.page,
          sort: options.sort,
          populate: options.populate,
          select: options.select
        })
      } else {
        result = await this.model.paginate(query, {
          limit: +options.limit,
          page: +options.page,
          sort: options.sort,
          select: options.select
        })
      }
      page.data = result.docs;
      page.total = result.total;
      page.limit = result.limit;
      page.page = result.page;
      page.hasNext = result.page * result.limit < result.total
      return page
    } else {
      let result = null;
      if (
        options.populate &&
        options.populate !== undefined &&
        options.populate !== ""
      ) {
        result = await this.model.find(query).populate(options.populate)
      } else {
        result = await this.model.find(query)
      }
      page.data = result
      page.total = result.length
      return page
    }
  }
  public async create(data: any, options: any): Promise<any> {
    let option = { ...options };
    let queue = option.queue;
    let result = await this.model.create(data);
    if (queue && queue === true) {
      Broker.publish(`${process.env.AMQP_SERVICE}.CREATE`, result, (err: any, publication: any) => {
        if (err) console.log('Rascal Error')
        publication.on('success', (messageId: any) => {
          console.log('success and messageId is', messageId)
        })
      })
    }

    return result
  }
  public async insertMany(data: any): Promise<any> {
    return this.model.insertMany(data);
  }
  public async update(query: any, data: any, options: any): Promise<any> {
    let option = { ...options };
    let queue = option.queue;
    let result = this.model.findOneAndUpdate(query, data, { new: true });
    if (queue && queue === true) {
      Broker.publish(`${process.env.AMQP_SERVICE}.UPDATE`, result, (err: any, publication: any) => {
        if (err) console.log('Rascal Error')
        publication.on('success', (messageId: any) => {
          console.log('success and messageId is', messageId)
        })
      })
    }
    return result
  }
  public async upsert(query: any, data: any): Promise<any> {
    return this.model.findOneAndUpdate(query, data, {
      upsert: true,
      new: true
    });
  }
  public async delete(data: any): Promise<any> {
    return this.model.delete
      ? this.model.delete(data)
      : this.model.remove(data);
  }
  public async aggregate(aggregate: any): Promise<any> {
    return this.model.aggregate(aggregate)
  }
  public async aggregatePaginate(query: any = {}, options: any = {}): Promise<any> {
    let page = {
      data: [],
      total: 0,
      limit: +options.limit || 10,
      page: +options.page || 1,
      hasNext: false
    }
    if (query) {
      if (typeof query === 'string') {
        query = JSON.parse(query)
      }
      // query = {name: 'd,dd,ddd'} => {name: ['d, 'dd', 'ddd']
      Object.keys(query).map(key => {
        if (typeof query[key] === "string") {
          query[key] = query[key].split(",");
        }
      })
    }
    if (options) {
      // options = {sort: '{"name": 1}"'}
      if (typeof options.sort === 'string') {
        options.sort = JSON.parse(options.sort)
      }
      if (typeof options.populate === 'string') {
        options.populate = JSON.parse(options.populate)
      }
    }
    const aggregate = this.model.aggregate(query)
    const result = await this.model.aggregatePaginate(aggregate, {
      limit: page.limit,
      page: page.page,
      sortBy: options.sort || undefined,
    })
    page.data = result.data;
    page.total = result.totalCount;
    page.hasNext = page.page * page.limit < result.totalCount;
    return page
  }
}

export default BaseRepository
