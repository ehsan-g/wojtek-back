import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) { }

  async findByUserName(username: string): Promise<UserEntity | null> {
    return await this.usersRepository.findOne({
      where: { username },
    });
  }

  async findByEmail(email: string) {
    return await this.usersRepository.findOne({
      where: { email },
    });
  }

  async findAll(): Promise<UserEntity[]> {
    return this.usersRepository.find();
  }

  async findOne(username: string): Promise<UserEntity | undefined> {
    return this.usersRepository.findOneBy({ username });
  }

  async create(createUserDto: CreateUserDto): Promise<UserEntity> {
    const { firstName, lastName, username, email, password } = createUserDto;
    const user = this.usersRepository.create({ firstName, lastName, email, username, password });
    return this.usersRepository.save(user);
  }

  async update(id: string | string, partial: Partial<UserEntity>) {
    await this.usersRepository.update(id, partial);
    return this.usersRepository.findOne({ where: { id } }); // return updated user if you want
  }
  async findOneWithPassword(username: string) {
    return this.usersRepository.createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.username = :username', { username })
      .getOne();
  }

}
